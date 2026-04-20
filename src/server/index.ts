import express from 'express'
import { Octokit } from '@octokit/rest'
import simpleGit from 'simple-git'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
app.use(express.json())
app.use(express.static(path.join(__dirname, '../../dist')))

const PROJECTS_DIR = path.join(__dirname, '../../projects')

// AI Prompt to parse natural language into requirements
function parsePrompt(prompt: string): any {
  const lowerPrompt = prompt.toLowerCase()
  
  // Extract short task name from prompt (first few words, max 30 chars)
  const taskMatch = prompt.match(/^(\S+\s+\S+)/i)
  let taskName = taskMatch ? taskMatch[1].trim() : 'update'
  taskName = taskName.replace(/[^a-zA-Z0-9а-яА-ЯёЁ]/gi, '-').toLowerCase()
  if (taskName.length > 30) taskName = taskName.substring(0, 30)
  
  // Check if this is an update/fix task
  if (lowerPrompt.includes('обновить') || lowerPrompt.includes('update') ||
      lowerPrompt.includes('устранить') || lowerPrompt.includes('fix') ||
      lowerPrompt.includes('уязвим') || lowerPrompt.includes('vulnerab')) {
    return {
      type: 'update',
      action: lowerPrompt.includes('зависимост') || lowerPrompt.includes('depend') ? 'update-deps' : 'fix-vulnerabilities',
      taskName
    }
  }
  
  // Extract app name from prompt
  const nameMatch = prompt.match(/(?:create|make|build|app|application)[\s:]+([^.,\n]+)/i)
  const appName = nameMatch ? nameMatch[1].trim().toLowerCase().replace(/\s+/g, '-') : taskName
  
  // Simple heuristic to identify components
  const components: any[] = []
  
  if (lowerPrompt.includes('todo') || lowerPrompt.includes('task') || lowerPrompt.includes('задач')) {
    components.push(
      { name: 'TodoList', type: 'functional' as const, props: { todos: 'Todo[]', onToggle: '(id: number) => void', onDelete: '(id: number) => void' } },
      { name: 'TodoItem', type: 'functional' as const, props: { todo: 'Todo', onToggle: '(id: number) => void', onDelete: '(id: number) => void' } },
      { name: 'AddTodo', type: 'functional' as const, props: { onAdd: '(text: string) => void' } }
    )
  }
  
  if (lowerPrompt.includes('header') || lowerPrompt.includes('title') || lowerPrompt.includes('заголовок')) {
    components.push({ name: 'Header', type: 'functional' as const, props: { title: 'string' } })
  }
  
  if (lowerPrompt.includes('input') || lowerPrompt.includes('form') || lowerPrompt.includes('ввод')) {
    components.push({ name: 'Input', type: 'functional' as const, props: { value: 'string', onChange: '(value: string) => void', onSubmit: '() => void' } })
  }
  
  if (lowerPrompt.includes('list') || lowerPrompt.includes('items') || lowerPrompt.includes('список')) {
    components.push({ name: 'List', type: 'functional' as const, props: { items: 'any[]', renderItem: '(item: any) => React.ReactNode' } })
  }
  
  if (lowerPrompt.includes('button') || lowerPrompt.includes('кнопк')) {
    components.push({ name: 'Button', type: 'functional' as const, props: { label: 'string', onClick: '() => void' } })
  }
  
  if (lowerPrompt.includes('card') || lowerPrompt.includes('карточк')) {
    components.push({ name: 'Card', type: 'functional' as const, props: { title: 'string', children: 'React.ReactNode' } })
  }
  
  if (lowerPrompt.includes('counter') || lowerPrompt.includes('счётчик')) {
    components.push({ name: 'Counter', type: 'functional' as const, props: {} })
  }
  
  if (lowerPrompt.includes('calculator') || lowerPrompt.includes('калькулятор')) {
    components.push({ name: 'Calculator', type: 'functional' as const, props: {} })
  }
  
  // Default to App component if nothing detected
  if (components.length === 0) {
    components.push({ name: 'App', type: 'functional' as const })
  }
  
  return {
    type: 'generate',
    taskName,
    name: appName,
    description: prompt.substring(0, 100),
    components,
    styles: 'css'
  }
}

app.post('/api/generate', async (req, res) => {
  try {
    const envToken = process.env.GITHUB_TOKEN
    const { token: requestToken, prompt, repo } = req.body

    console.log('=== GENERATE REQUEST ===')
    console.log('Repo:', repo)
    console.log('Prompt:', prompt?.substring(0, 100) + '...')
    
    const token = envToken || requestToken
    if (!token) {
      return res.status(400).json({ 
        error: 'GitHub token required. Set GITHUB_TOKEN in .env file.'
      })
    }

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: 'Prompt is required' })
    }

    if (!repo) {
      return res.status(400).json({ error: 'Repository is required. Select a repository.' })
    }

    // Parse prompt into requirements
    const requirements = await parsePrompt(prompt)
    console.log('Parsed requirements:', JSON.stringify(requirements, null, 2))

    let repoUrl = ''
    let previewUrl = ''

    if (requirements.type === 'update') {
      // Handle update tasks (update deps, fix vulnerabilities)
      console.log('Processing update task:', requirements.action)
      repoUrl = await updateRepoFiles(token, repo, requirements.action, requirements.taskName)
    } else {
      // Generate React project from requirements
      const projectPath = await generateProject(requirements)
      console.log('Project generated at:', projectPath)
      repoUrl = await pushToRepo(token, repo, projectPath, requirements.taskName)
    }
    
    console.log('Completed:', repoUrl)
    res.json({ 
      previewUrl, 
      repoUrl, 
      repo: repo,
      message: 'Update completed successfully'
    })
  } catch (error) {
    console.error('Error:', error)
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Generation failed',
      stack: error instanceof Error ? error.stack : undefined
    })
  }
})

// Get user's repositories
app.get('/api/repos', async (req, res) => {
  try {
    const token = process.env.GITHUB_TOKEN
    if (!token) {
      return res.status(400).json({ error: 'GitHub token required' })
    }

    const octokit = new Octokit({ auth: token })
    const username = (await octokit.users.getAuthenticated()).data.login

    // Get user repos (limit 30)
    const { data: repos } = await octokit.repos.listForUser({
      username,
      sort: 'updated',
      per_page: 30
    })

    res.json({ 
      repos: repos.map(r => ({ 
        name: r.name, 
        full_name: r.full_name 
      })) 
    })
  } catch (error) {
    console.error('Error:', error)
    res.status(500).json({ error: 'Failed to fetch repositories' })
  }
})

// Update package.json in existing repo
async function updateRepoFiles(token: string, repoFullName: string, action: string, taskName: string): Promise<string> {
  const { execSync } = await import('child_process')
  const octokit = new Octokit({ auth: token })
  const fsPromises = await import('fs/promises')
  
  const [owner, repo] = repoFullName.split('/')
  // Add timestamp suffix to ensure unique branch name
  const timestamp = Date.now().toString(36)
  const branchName = `vibe-${taskName.toLowerCase().replace(/[^a-z0-9-]/g, '-')}-${timestamp}`
  
  try {
    // Get default branch
    const { data: repoInfo } = await octokit.repos.get({ owner, repo })
    const defaultBranch = repoInfo.default_branch || 'main'
    console.log(`Default branch: ${defaultBranch}`)
    
    // Clone existing repo
    const gitUrl = `https://${token}@github.com/${owner}/${repo}.git`
    const tempDir = path.join(__dirname, '../../temp-clones', repo)
    
    await fs.rm(tempDir, { recursive: true, force: true })
    await fs.mkdir(tempDir, { recursive: true })
    
    console.log(`Cloning ${owner}/${repo}...`)
    execSync(`git clone ${gitUrl} .`, { cwd: tempDir, stdio: 'pipe' })
    execSync(`git checkout ${defaultBranch}`, { cwd: tempDir, stdio: 'pipe' })
    execSync(`git checkout -b ${branchName}`, { cwd: tempDir, stdio: 'pipe' })
    
    // Check if package.json exists
    let packageJson: any = null
    try {
      const packagePath = path.join(tempDir, 'package.json')
      const content = await fsPromises.readFile(packagePath, 'utf-8')
      packageJson = JSON.parse(content)
    } catch {
      console.log('No package.json found')
    }
    
    if (packageJson && action === 'update-deps') {
      // Update dependencies to latest versions
      const latestVersions: Record<string, string> = {
        react: '^18.3.1',
        'react-dom': '^18.3.1',
        'react-scripts': '^5.0.1',
        typescript: '^5.5.0',
        vite: '^5.4.0',
        '@vitejs/plugin-react': '^4.3.0'
      }
      
      // Update dependencies
      if (packageJson.dependencies) {
        for (const [dep, latestVer] of Object.entries(latestVersions)) {
          if (packageJson.dependencies[dep]) {
            packageJson.dependencies[dep] = latestVer
            console.log(`Updated ${dep} to ${latestVer}`)
          }
        }
      }
      
      // Update devDependencies
      if (packageJson.devDependencies) {
        for (const [dep, latestVer] of Object.entries(latestVersions)) {
          if (packageJson.devDependencies[dep]) {
            packageJson.devDependencies[dep] = latestVer
            console.log(`Updated dev ${dep} to ${latestVer}`)
          }
        }
      }
      
      // Write updated package.json
      await fsPromises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2) + '\n'
      )
      console.log('Updated package.json')
    }
    
    // Commit and push
    console.log('Committing and pushing...')
    execSync(`git add -A`, { cwd: tempDir, stdio: 'pipe' })
    execSync(`git commit -m "Vibe Coding: ${taskName}"`, { cwd: tempDir, stdio: 'pipe' })
    execSync(`git push origin ${branchName}`, { cwd: tempDir, stdio: 'pipe' })
    
    // Create Pull Request
    console.log('Creating Pull Request...')
    const prTitle = `Vibe Coding: ${taskName}`
    const { data: pr } = await octokit.pulls.create({
      owner,
      repo,
      title: prTitle,
      body: `Created by Vibe Coding Tool\n\nTask: ${taskName}\n\nPlease review and merge.`,
      head: branchName,
      base: defaultBranch
    })
    
    console.log('PR created:', pr.html_url)
    return pr.html_url
  } catch (error) {
    console.error('Update error:', error)
    throw error
  }
}

async function generateProject(requirements: any): Promise<string> {
  const projectName = requirements.name.replace(/[^a-z0-9-]/gi, '-')
  const projectPath = path.join(PROJECTS_DIR, projectName)

  await fs.mkdir(projectPath, { recursive: true })
  await fs.mkdir(path.join(projectPath, 'src'), { recursive: true })

  // Generate package.json
  await fs.writeFile(
    path.join(projectPath, 'package.json'),
    JSON.stringify({
      name: projectName,
      version: '1.0.0',
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'tsc && vite build',
        preview: 'vite preview'
      },
      dependencies: {
        react: '^18.2.0',
        'react-dom': '^18.2.0'
      },
      devDependencies: {
        typescript: '^5.0.0',
        vite: '^5.0.0',
        '@vitejs/plugin-react': '^4.0.0'
      }
    }, null, 2)
  )

  // Generate components
  for (const component of requirements.components || []) {
    const componentPath = path.join(projectPath, 'src', `${component.name}.tsx`)
    
    const componentCode = generateComponent(component)
    await fs.writeFile(componentPath, componentCode)
    console.log(`Generated component: ${component.name}`)
  }

  // Generate main.tsx
  const mainComponent = requirements.components?.[0]?.name || 'App'
  const mainPath = path.join(projectPath, 'src', 'main.tsx')
  await fs.writeFile(mainPath, `import React from 'react'
import ReactDOM from 'react-dom/client'
import { ${mainComponent} } from './${mainComponent}'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <${mainComponent} />
  </React.StrictMode>,
)
`)

  // Generate App.tsx
  const appPath = path.join(projectPath, 'src', 'App.tsx')
  await fs.writeFile(appPath, `export const App: React.FC = () => {
  return (
    <div>
      <h1>${requirements.name}</h1>
      <p>${requirements.description || 'Generated by Vibe Coding Tool'}</p>
    </div>
  )
}
`)

  // Generate index.css
  await fs.writeFile(
    path.join(projectPath, 'src', 'index.css'),
    '* { margin: 0; padding: 0; box-sizing: border-box; }\nbody { font-family: sans-serif; }\n'
  )

  // Generate index.html
  await fs.writeFile(
    path.join(projectPath, 'index.html'),
    `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${requirements.name}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`
  )

  // Generate vite.config.ts
  await fs.writeFile(
    path.join(projectPath, 'vite.config.ts'),
    `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000
  }
})
`
  )

  // Generate tsconfig.json
  await fs.writeFile(
    path.join(projectPath, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        target: 'ES2020',
        useDefineForClassFields: true,
        lib: ['ES2020', 'DOM', 'DOM.Iterable'],
        module: 'ESNext',
        skipLibCheck: true,
        moduleResolution: 'bundler',
        allowImportingTsExtensions: true,
        resolveJsonModule: true,
        isolatedModules: true,
        noEmit: true,
        jsx: 'react-jsx',
        strict: true
      },
      include: ['src']
    }, null, 2)
  )

  return projectPath
}

function generateComponent(component: any): string {
  const props = component.props || {}
  const stateEntries = Object.entries(component.state || {})

  let code = `import React from 'react'\n\n`
  
  if (Object.keys(props).length > 0) {
    code += `interface Props {\n`
    for (const [key, type] of Object.entries(props)) {
      code += `  ${key}: ${type}\n`
    }
    code += `}\n\n`
  }

  code += `export const ${component.name}: React.FC${Object.keys(props).length > 0 ? '<Props>' : ''} = (${Object.keys(props).length > 0 ? 'props' : ''}) => {\n`
  
  for (const [key, type] of stateEntries) {
    code += `  const [${key}, set${key.charAt(0).toUpperCase() + key.slice(1)}] = React.useState<${type}>(/* initial value */)\n`
  }

  if (stateEntries.length > 0) code += '\n'

  code += `  return (\n`
  code += `    <div>\n`
  code += `      <h1>${component.name}</h1>\n`
  code += `      {/* Component implementation */}\n`
  code += `    </div>\n`
  code += `  )\n`
  code += `}\n`

  return code
}

async function pushToRepo(token: string, repoFullName: string, projectPath: string, taskName: string): Promise<string> {
  const { execSync } = await import('child_process')
  const octokit = new Octokit({ auth: token })
  
  const [owner, repo] = repoFullName.split('/')
  // Add timestamp suffix to ensure unique branch name
  const timestamp = Date.now().toString(36)
  const branchName = `vibe-${taskName.toLowerCase().replace(/[^a-z0-9-]/g, '-')}-${timestamp}`
  
  try {
    // Get default branch from GitHub
    const { data: repoInfo } = await octokit.repos.get({ owner, repo })
    const defaultBranch = repoInfo.default_branch || 'main'
    console.log(`Default branch: ${defaultBranch}`)
    
    // Clone existing repo
    const gitUrl = `https://${token}@github.com/${owner}/${repo}.git`
    const tempDir = path.join(__dirname, '../../temp-clones', repo)
    
    await fs.rm(tempDir, { recursive: true, force: true })
    await fs.mkdir(tempDir, { recursive: true })
    
    console.log(`Cloning ${owner}/${repo}...`)
    execSync(`git clone ${gitUrl} .`, { cwd: tempDir, stdio: 'pipe' })
    
    // Checkout default branch
    execSync(`git checkout ${defaultBranch}`, { cwd: tempDir, stdio: 'pipe' })
    
    // Create and checkout new branch
    console.log(`Creating branch: ${branchName}`)
    execSync(`git checkout -b ${branchName}`, { cwd: tempDir, stdio: 'pipe' })
    
    // Copy new files (overwrite existing)
    const entries = await fs.readdir(projectPath)
    for (const entry of entries) {
      const srcPath = path.join(projectPath, entry)
      const destPath = path.join(tempDir, entry)
      await fs.rm(destPath, { recursive: true, force: true })
      await fs.cp(srcPath, destPath, { recursive: true, force: true })
    }
    
    // Add all files, commit and push
    console.log('Committing and pushing...')
    execSync(`git add -A`, { cwd: tempDir, stdio: 'pipe' })
    execSync(`git commit -m "Vibe Coding: ${taskName}"`, { cwd: tempDir, stdio: 'pipe' })
    execSync(`git push origin ${branchName}`, { cwd: tempDir, stdio: 'pipe' })
    
    // Create Pull Request
    console.log('Creating Pull Request...')
    const prTitle = `Vibe Coding: ${taskName}`
    const { data: pr } = await octokit.pulls.create({
      owner,
      repo,
      title: prTitle,
      body: `Created by Vibe Coding Tool\n\nTask: ${taskName}\n\nPlease review and merge.`,
      head: branchName,
      base: defaultBranch
    })
    
    console.log('PR created:', pr.html_url)
    return pr.html_url
  } catch (error) {
    console.error('Push error:', error)
    throw error
  }
}

const PORT = process.env.PORT || 8080
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})

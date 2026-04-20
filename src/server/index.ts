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
async function parsePrompt(prompt: string): Promise<any> {
  // Extract app name from prompt
  const nameMatch = prompt.match(/(?:create|make|build|app|application)[\s:]+([^.,\n]+)/i)
  const appName = nameMatch ? nameMatch[1].trim().toLowerCase().replace(/\s+/g, '-') : 'my-app'
  
  // Simple heuristic to identify components
  const components: any[] = []
  
  if (prompt.toLowerCase().includes('todo') || prompt.toLowerCase().includes('task')) {
    components.push(
      { name: 'TodoList', type: 'functional' as const, props: { todos: 'Todo[]', onToggle: '(id: number) => void', onDelete: '(id: number) => void' } },
      { name: 'TodoItem', type: 'functional' as const, props: { todo: 'Todo', onToggle: '(id: number) => void', onDelete: '(id: number) => void' } },
      { name: 'AddTodo', type: 'functional' as const, props: { onAdd: '(text: string) => void' } }
    )
  }
  
  if (prompt.toLowerCase().includes('header') || prompt.toLowerCase().includes('title')) {
    components.push({ name: 'Header', type: 'functional' as const, props: { title: 'string' } })
  }
  
  if (prompt.toLowerCase().includes('input') || prompt.toLowerCase().includes('form')) {
    components.push({ name: 'Input', type: 'functional' as const, props: { value: 'string', onChange: '(value: string) => void', onSubmit: '() => void' } })
  }
  
  if (prompt.toLowerCase().includes('list') || prompt.toLowerCase().includes('items')) {
    components.push({ name: 'List', type: 'functional' as const, props: { items: 'any[]', renderItem: '(item: any) => React.ReactNode' } })
  }
  
  if (prompt.toLowerCase().includes('button')) {
    components.push({ name: 'Button', type: 'functional' as const, props: { label: 'string', onClick: '() => void' } })
  }
  
  if (prompt.toLowerCase().includes('card')) {
    components.push({ name: 'Card', type: 'functional' as const, props: { title: 'string', children: 'React.ReactNode' } })
  }
  
  // Default to App component if nothing detected
  if (components.length === 0) {
    components.push({ name: 'App', type: 'functional' as const })
  }
  
  return {
    name: appName,
    description: prompt.substring(0, 100),
    components,
    styles: 'css'
  }
}

app.post('/api/generate', async (req, res) => {
  try {
    // Use token from env or from request
    const envToken = process.env.GITHUB_TOKEN
    const { token: requestToken, prompt } = req.body

    console.log('=== GENERATE REQUEST ===')
    console.log('Token from .env:', envToken ? `YES (${envToken.substring(0, 20)}...)` : 'NO')
    console.log('Token from request:', requestToken ? 'YES' : 'NO')
    
    const token = envToken || requestToken
    if (!token) {
      return res.status(400).json({ 
        error: 'GitHub token required. Set GITHUB_TOKEN in .env file.'
      })
    }

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: 'Prompt is required' })
    }

    console.log('Prompt:', prompt.substring(0, 100) + '...')
    
    // Parse prompt into requirements
    const requirements = await parsePrompt(prompt)
    console.log('Parsed requirements:', JSON.stringify(requirements, null, 2))

    // Generate React project from requirements
    const projectPath = await generateProject(requirements)
    console.log('Project generated at:', projectPath)

    // Create new GitHub repo and PR
    const { owner, repo, prUrl } = await createGitHubRepo(token, requirements.name, projectPath)
    console.log('PR created:', prUrl)

    // Start preview (placeholder for Docker container)
    const previewUrl = `http://localhost:3001/${requirements.name}`
    console.log('Preview URL:', previewUrl)

    res.json({ 
      previewUrl, 
      prUrl, 
      repo: `${owner}/${repo}`,
      message: 'Project generated successfully'
    })
  } catch (error) {
    console.error('Error:', error)
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Generation failed',
      stack: error instanceof Error ? error.stack : undefined
    })
  }
})

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

async function createGitHubRepo(token: string, name: string, projectPath: string) {
  const octokit = new Octokit({ auth: token })
  const repoName = `vibe-coding-${name.toLowerCase().replace(/[^a-z0-9-]/gi, '-')}-${Date.now()}`
  
  try {
    const username = (await octokit.users.getAuthenticated()).data.login
    console.log(`Authenticated as: ${username}`)

    // Create new repo
    await octokit.repos.createForAuthenticatedUser({
      name: repoName,
      private: false,
      auto_init: true
    })
    console.log(`Created repo: ${username}/${repoName}`)

    // Use exec to clone and push
    const { execSync } = await import('child_process')
    const tempDir = path.join(__dirname, '../../temp-clones', repoName)
    await fs.mkdir(tempDir, { recursive: true })
    
    // Clone withGitHub token
    const gitUrl = `https://${username}:${token}@github.com/${username}/${repoName}.git`
    
    // Try clone and push
    try {
      execSync(`git clone ${gitUrl} temp-clones/${repoName}`, { 
        cwd: path.join(__dirname, '../..'),
        stdio: 'pipe'
      })
    } catch {
      // If clone fails, try init and push
      execSync(`git init && git remote add origin ${gitUrl}`, { cwd: tempDir, stdio: 'pipe' })
    }
    
    // Copy files
    await fs.cp(projectPath, tempDir, { recursive: true, force: true })
    
    // Commit and push with force
    execSync(`git add . && git commit -m "Initial commit from Vibe Coding Tool" && git push -u origin main --force`, { 
      cwd: tempDir,
      stdio: 'pipe'
    })
    console.log('Pushed to GitHub')

    // Return repo URL (PR not needed for new repo)
    const repoUrl = `https://github.com/${username}/${repoName}`

    return { owner: username, repo: repoName, prUrl: repoUrl }
  } catch (error) {
    console.error('GitHub error:', error)
    throw error
  }
}

const PORT = process.env.PORT || 8080
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})

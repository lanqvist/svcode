import React from 'react'

interface Props {
  todos: Todo[]
  onToggle: (id: number) => void
  onDelete: (id: number) => void
}

export const TodoList: React.FC<Props> = (props) => {
  return (
    <div>
      <h1>TodoList</h1>
      {/* Component implementation */}
    </div>
  )
}

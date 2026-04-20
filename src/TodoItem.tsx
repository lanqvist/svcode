import React from 'react'

interface Props {
  todo: Todo
  onToggle: (id: number) => void
  onDelete: (id: number) => void
}

export const TodoItem: React.FC<Props> = (props) => {
  return (
    <div>
      <h1>TodoItem</h1>
      {/* Component implementation */}
    </div>
  )
}

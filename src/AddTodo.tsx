import React from 'react'

interface Props {
  onAdd: (text: string) => void
}

export const AddTodo: React.FC<Props> = (props) => {
  return (
    <div>
      <h1>AddTodo</h1>
      {/* Component implementation */}
    </div>
  )
}

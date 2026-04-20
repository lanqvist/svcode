import React from 'react'

interface Props {
  items: any[]
  renderItem: (item: any) => React.ReactNode
}

export const List: React.FC<Props> = (props) => {
  return (
    <div>
      <h1>List</h1>
      {/* Component implementation */}
    </div>
  )
}

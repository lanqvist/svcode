import React from 'react'

interface Props {
  label: string
  onClick: () => void
}

export const Button: React.FC<Props> = (props) => {
  return (
    <div>
      <h1>Button</h1>
      {/* Component implementation */}
    </div>
  )
}

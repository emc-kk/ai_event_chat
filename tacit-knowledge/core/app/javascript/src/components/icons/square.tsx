import React from 'react'

interface SquareIconProps extends React.SVGProps<SVGSVGElement> {}

export const Square: React.FC<SquareIconProps> = (props) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect x="6" y="6" width="12" height="12" />
    </svg>
  )
}


import React from 'react'
import { createContext } from 'react'

export const AdminDataContext = createContext()

const AdminContext = ({ children }) => {
  const [admin, setAdmin] = React.useState({
    Email: '',
    Username : " "
  })
  const [isLoading, setIsLoading] = useState(null)
  const [error, setError] = useState(null)

  return (
    <AdminDataContext.Provider value={{ admin, setAdmin , isLoading, setIsLoading, error, setError }}>
      {children}
    </AdminDataContext.Provider>
  )
}

export default UserContext

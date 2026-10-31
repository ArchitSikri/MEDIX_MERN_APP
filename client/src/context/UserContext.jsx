import React from 'react'
import { createContext } from 'react'

export const UserDataContext = createContext()

const UserContext = ({ children }) => {
  const [user, setUser] = React.useState({
    Email: '',
    Username : " "
  })
  const [isLoading, setIsLoading] = useState(null)
  const [error, setError] = useState(null)

  return (
    <UserDataContext.Provider value={{ user, setUser , isLoading, setIsLoading, error, setError }}>
      {children}
    </UserDataContext.Provider>
  )
}

export default UserContext

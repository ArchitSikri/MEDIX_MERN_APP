import { useAuthSession } from './authSession.js'
import { UserDataContext } from './UserDataContext.js'

const UserContext = ({ children }) => {
  const auth = useAuthSession({
    role: 'user',
    authPath: '/api/user/auth',
    accountKey: 'user'
  })

  return (
    <UserDataContext.Provider value={{ ...auth, user: auth.account, setUser: auth.setAccount }}>
      {children}
    </UserDataContext.Provider>
  )
}

export default UserContext

import { useAuthSession } from './authSession.js'
import { DoctorDataContext } from './DoctorDataContext.js'

const DoctorContext = ({ children }) => {
  const auth = useAuthSession({
    role: 'doctor',
    authPath: '/api/doctor/auth',
    accountKey: 'doctor'
  })

  return (
    <DoctorDataContext.Provider value={{ ...auth, doctor: auth.account, setDoctor: auth.setAccount }}>
      {children}
    </DoctorDataContext.Provider>
  )

}

export default DoctorContext

import React, { createContext, useState } from 'react'

export const DoctorDataContext = createContext()

const DoctorContext = ({ children }) => {
  const [doctor, setdoctor] = useState(null)
  const [isLoading, setIsLoading] = useState(null)
  const [error, setError] = useState(null)

  const value = {
    doctor, setdoctor,
    isLoading,
    setIsLoading,
    error,
    setError
  }

  return (
    <DoctorDataContext.Provider value={value}>
      {children}
    </DoctorDataContext.Provider>
  )

}

export default DoctorContext



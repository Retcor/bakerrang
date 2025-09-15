import React, { useEffect, useState } from 'react'
import { AddVoiceModal, ContentWrapper, LoadingSpinner } from './index.js'
import { useTheme } from '../providers/ThemeProvider.jsx'
import { useAppContext } from '../providers/AppProvider.jsx'
import VoiceRow from './VoiceRow.jsx'
import { request } from '../utils/index.js'
import { SERVER_PREFIX } from '../App.jsx'
import { productLicenses } from '../constants/index.js'
import ProductLicense from './ProductLicense.jsx'

const Account = () => {
  const { isDark } = useTheme()
  const { voices, setVoices } = useAppContext()
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [licenses, setLicenses] = useState([])
  const [isLicenseSaving, setIsLicenseSaving] = useState(false)
  const [isVoicesUpdating, setIsVoicesUpdating] = useState(false)

  useEffect(() => {
    const getLicenses = async () => {
      const res = await request(`${SERVER_PREFIX}/supermarket/licenses`, 'GET')
      const licenses = await res.json()
      setLicenses(licenses)
    }

    getLicenses() // Call immediately upon page load
  }, [])

  const addVoiceSuccess = voice => {
    setVoices([...voices, voice])
    setAddModalOpen(false)
  }

  const saveLicenses = async () => {
    setIsLicenseSaving(true)
    await request(`${SERVER_PREFIX}/supermarket/licenses`, 'POST', { 'Content-Type': 'application/json' }, JSON.stringify({ licenses }))
    setIsLicenseSaving(false)
  }

  const updateVoices = async () => {
    setIsVoicesUpdating(true)
    await request(`${SERVER_PREFIX}/text/to/speech/v1/voices`, 'PUT', { 'Content-Type': 'application/json' }, JSON.stringify({ voices }))
    setIsVoicesUpdating(false)
  }

  return (
    <ContentWrapper title='Account'>
      <div className={`mt-8 w-full p-6 rounded-lg transition-all duration-300 ${isDark ? 'glass-card-dark glass-hover-dark' : 'glass-card-light glass-hover-light'}`}>
        <div className='mb-4 bg-[#D4ED31] rounded-md p-2 w-36 text-center'>
          <h3 className='text-gray-900 font-bold text-lg'>
            Cloned Voices
          </h3>
        </div>
        <div className='mb-4'>
          {voices && voices.map(v => (
            <React.Fragment key={v.id}>
              <VoiceRow voice={v} />
            </React.Fragment>
          ))}
        </div>
        <div className='flex gap-2'>
          <button onClick={() => setAddModalOpen(true)} className={`font-bold px-4 py-2 rounded transition-all duration-200 ${isDark ? 'glass-dark text-theme-dark hover:bg-white/20' : 'glass-light text-theme-light hover:bg-black/20'}`}>Add</button>
          <button onClick={() => updateVoices()} className='bg-[#D4ED31] hover:bg-[#c4d929] text-gray-800 font-bold px-4 py-2 rounded transition-all duration-200 shadow-lg'>
            {isVoicesUpdating ? <LoadingSpinner svgClassName='!h-4 !w-4' /> : 'Update'}
          </button>
          <AddVoiceModal open={addModalOpen} cancel={() => setAddModalOpen(false)} success={addVoiceSuccess} />
        </div>
      </div>
      <div className={`mt-8 w-full p-6 rounded-lg transition-all duration-300 ${isDark ? 'glass-card-dark glass-hover-dark' : 'glass-card-light glass-hover-light'}`}>
        <div className='mb-4 bg-[#D4ED31] rounded-md p-2 w-48 text-center'>
          <h3 className='text-gray-900 font-bold text-lg'>
            SuperMarket Licenses
          </h3>
        </div>
        <div className='flex flex-wrap -mx-2 mb-4'>
          {productLicenses.map(pl => (
            <ProductLicense key={pl.licenseId} licenses={licenses} setLicenses={setLicenses} productLicense={pl} />
          ))}
        </div>
        <div>
          <button onClick={() => saveLicenses()} className='bg-[#D4ED31] hover:bg-[#c4d929] text-gray-800 font-bold px-4 py-2 rounded transition-all duration-200 shadow-lg'>
            {isLicenseSaving ? <LoadingSpinner svgClassName='!h-4 !w-4' /> : 'Save'}
          </button>
        </div>
      </div>
    </ContentWrapper>
  )
}

export default Account

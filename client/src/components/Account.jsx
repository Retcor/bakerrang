import React, { useEffect, useState } from 'react'
import { AddVoiceModal, ContentWrapper, LoadingSpinner } from './index.js'
import { Button, Card, CardBody, CardFooter, CardHeader, Typography } from '@material-tailwind/react'
import { useAppContext } from '../providers/AppProvider.jsx'
import VoiceRow from './VoiceRow.jsx'
import { request } from '../utils/index.js'
import { SERVER_PREFIX } from '../App.jsx'
import { productLicenses } from '../constants/index.js'
import ProductLicense from './ProductLicense.jsx'

const Account = () => {
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
      <Card className='mt-8 bg-gray-900 w-full'>
        <CardHeader
          variant='gradient'
          className='mb-4 grid top-3 h-6 bg-[#D4ED31] w-36 place-items-center'
        >
          <Typography variant='h6' className='text-gray-900'>
            Cloned Voices
          </Typography>
        </CardHeader>
        <CardBody>
          {voices && voices.map(v => (
            <React.Fragment key={v.id}>
              <VoiceRow voice={v} />
            </React.Fragment>
          ))}
        </CardBody>
        <CardFooter className='pt-0'>
          <Button onClick={() => setAddModalOpen(true)} className='text-white font-bold bg-blue-500 hover:bg-blue-700'>Add</Button>
          <Button onClick={() => updateVoices()} className='text-white font-bold bg-blue-500 hover:bg-blue-700 ml-2'>
            {isVoicesUpdating ? <LoadingSpinner svgClassName='!h-4 !w-4' /> : 'Update'}
          </Button>
          <AddVoiceModal open={addModalOpen} cancel={() => setAddModalOpen(false)} success={addVoiceSuccess} />
        </CardFooter>
      </Card>
      <Card className='mt-8 bg-gray-900 w-full'>
        <CardHeader
          variant='gradient'
          className='mb-4 grid top-3 h-6 bg-[#D4ED31] w-48 place-items-center'
        >
          <Typography variant='h6' className='text-gray-900'>
            SuperMarket Licenses
          </Typography>
        </CardHeader>
        <CardBody className='flex flex-wrap -mx-2'>
          {productLicenses.map(pl => (
            <ProductLicense key={pl.licenseId} licenses={licenses} setLicenses={setLicenses} productLicense={pl} />
          ))}
        </CardBody>
        <CardFooter className='pt-0'>
          <Button onClick={() => saveLicenses()} className='text-white font-bold bg-blue-500 hover:bg-blue-700'>
            {isLicenseSaving ? <LoadingSpinner svgClassName='!h-4 !w-4' /> : 'Save'}
          </Button>
        </CardFooter>
      </Card>
    </ContentWrapper>
  )
}

export default Account

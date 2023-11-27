import React, { useState } from 'react'
import { AddVoiceModal, ContentWrapper } from './index.js'
import { Button, Card, CardBody, CardFooter, CardHeader, Typography } from '@material-tailwind/react'
import { useAppContext } from '../providers/AppProvider.jsx'
import VoiceRow from './VoiceRow.jsx'

const Account = () => {
  const { voices, setVoices } = useAppContext()
  const [addModalOpen, setAddModalOpen] = useState(false)

  const addVoiceSuccess = voice => {
    setVoices([...voices, voice])
    setAddModalOpen(false)
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
          <AddVoiceModal open={addModalOpen} cancel={() => setAddModalOpen(false)} success={addVoiceSuccess} />
        </CardFooter>
      </Card>
    </ContentWrapper>
  )
}

export default Account

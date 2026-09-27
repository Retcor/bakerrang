import React from 'react'
import { AlertIcon } from '../Icons.jsx'

export const FieldError = ({ id, children }) => <small className='bd-field-error' id={id}><AlertIcon /><span>{children}</span></small>

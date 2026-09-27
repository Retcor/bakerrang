/* eslint-disable react/jsx-handler-names */
import React from 'react'
import { Button } from '@bakerrang/web-ui'
import { useAuth } from '@bakerrang/web-auth'

const GoogleIcon = () => <svg className='bd-google' viewBox='0 0 24 24' aria-hidden='true'><path fill='currentColor' d='M23.5 12.3c0-.9-.1-1.5-.2-2.2H12v4.1h6.5c-.1 1-.8 2.6-2.3 3.6l3.6 2.8c2.1-2 3.7-4.9 3.7-8.3zM12 24c3.2 0 5.9-1.1 7.9-2.9l-3.6-2.8c-1 .7-2.3 1.2-4.3 1.2-3.3 0-6.1-2.2-7.1-5.2l-3.7 2.9C3.2 21.3 7.3 24 12 24zM4.9 14.3c-.2-.7-.4-1.5-.4-2.3s.1-1.6.4-2.3L1.2 6.8C.4 8.3 0 10.1 0 12s.4 3.7 1.2 5.2l3.7-2.9zM12 4.8c1.8 0 3 .8 3.7 1.4l2.7-2.7C16.9 1.9 14.4.9 12 .9 7.3.9 3.2 3.6 1.2 6.8l3.7 2.9C5.9 6.7 8.7 4.8 12 4.8z' /></svg>

const ExamplePeriod = ({ date, source, amount, line, bills, left }) => (
  <section className='bd-example__period'>
    <div className='bd-example__band'><b>Paycheck · {date} · {source}</b><strong>{amount}</strong></div>
    <p>{line}</p>
    <dl>{bills.map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}<div className='bd-example__total'><dt>Left</dt><dd>{left}</dd></div></dl>
  </section>
)

export const Welcome = () => {
  const auth = useAuth()
  return (
    <main className='bd-welcome'>
      <section><h1>See what every paycheck has to cover.</h1><p className='bd-lead'>Budget lines your bills up against your paydays, month by month. Each paycheck shows what it has to pay before the next one arrives, and what's left.</p><Button variant='gold' onClick={auth.login}><GoogleIcon />Sign in with Google</Button><p className='bd-privacy'>Budget is a plan, not a bank feed. You add your paydays and bills yourself, and nothing connects to your accounts. Your plan is saved to your BakerRang account.</p></section>
      <section className='bd-example' aria-label='Example: two paychecks from a sample plan'>
        <div className='bd-example__tag'><span>Example</span><span>Sample figures</span></div>
        <ExamplePeriod date='Fri, Sep 4' source='Acme payroll' amount='$2,140.00' line='Pay period Sep 4 – Sep 14' bills={[['Car loan · Sep 5', '$318.40'], ['Electric · Sep 9', '$96.18']]} left='$1,725.42' />
        <ExamplePeriod date='Tue, Sep 15' source='Tutoring' amount='$380.00' line='Pay period Sep 15 – Sep 17' bills={[['Dentist · Sep 16', '$260.00']]} left='$120.00' />
      </section>
    </main>
  )
}

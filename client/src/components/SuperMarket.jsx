import React, { useEffect, useState } from 'react'
import { SERVER_PREFIX } from '../App.jsx'
import { productLicenses } from '../constants/index.js'
import { request } from '../utils/index.js'
import ContentWrapper from './ContentWrapper.jsx'
import { Button } from '@material-tailwind/react'
import ProductCounter from './ProductCounter.jsx'
import { ConfirmModal } from './index.js'

const SuperMarket = () => {
  const [initialProducts, setInitialProducts] = useState([])
  const [products, setProducts] = useState([])
  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await request(`${SERVER_PREFIX}/supermarket/licenses`, 'GET')
        const licenses = await res.json()
        if (licenses && licenses.length > 0) {
          const productCounters = productLicenses
            .filter(pl => licenses.includes(pl.licenseId))
            .flatMap(pl => pl.products.map(p => ({
              descr: p.descr,
              icon: p.icon,
              count: 0
            })))
          setInitialProducts(productCounters)
          setProducts(productCounters)
        }
      } catch (error) {
        console.error('Failed to fetch products:', error)
      }
    }

    fetchProducts()
  }, [])

  const incrementProduct = descr => {
    setProducts(currentProducts =>
      currentProducts.map(product =>
        product.descr === descr ? { ...product, count: product.count + 1 } : product
      )
    )
  }

  const decrementProduct = descr => {
    setProducts(currentProducts =>
      currentProducts.map(product =>
        product.descr === descr ? { ...product, count: product.count - 1 } : product
      )
    )
  }

  const sortProducts = () => {
    setProducts(currentProducts =>
      [...currentProducts].sort((a, b) => b.count - a.count)
    )
  }

  const checkResetProducts = () => {
    setConfirmOpen(true)
  }

  const resetProducts = () => {
    setProducts([...initialProducts])
    setConfirmOpen(false)
  }

  return (
    <ContentWrapper title='Supermarket'>
      <ConfirmModal
        open={confirmOpen}
        title='Confirmation'
        message='Are you sure you want to reset the list?'
        confirmFunc={resetProducts}
        cancelFunc={() => setConfirmOpen(false)}
      />
      <p className='text-xs text-white font-medium'>
        A simple checklist app to manage Supermarket Simulator products. Visit the Account page to add Product Licenses to list Products here.
      </p>
      {products.length > 0 && (
        <div className='my-2'>
          <Button onClick={sortProducts} className='text-white font-bold bg-blue-500 hover:bg-blue-700'>Sort</Button>
          <Button onClick={checkResetProducts} className='text-white mx-2 font-bold bg-blue-500 hover:bg-blue-700'>Reset</Button>
        </div>
      )}
      {products.length > 0 && products.map(product => (
        <ProductCounter
          key={product.descr}
          product={product}
          incrementer={() => incrementProduct(product.descr)}
          decrementer={() => decrementProduct(product.descr)}
        />
      ))}
    </ContentWrapper>
  )
}

export default SuperMarket

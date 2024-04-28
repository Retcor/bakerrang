import React, { useEffect, useState } from 'react'
import { SERVER_PREFIX } from '../App.jsx'
import { productLicenses } from '../constants/index.js'
import { request } from '../utils/index.js'
import ContentWrapper from './ContentWrapper.jsx'
import { Button } from '@material-tailwind/react'
import ProductCounter from './ProductCounter.jsx'

const SuperMarket = () => {
  const [initialProducts, setInitialProducts] = useState([])
  const [products, setProducts] = useState([])

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

  const resetProducts = () => {
    setProducts([...initialProducts])
  }

  return (
    <ContentWrapper title='Supermarket'>
      <p className='text-xs text-white font-medium'>
        A simple checklist app to manage Supermarket Simulator products. Visit the Account page to add Product Licenses to list Products here.
      </p>
      {products.length > 0 && (
        <div className='my-2'>
          <Button onClick={sortProducts} className='text-white font-bold bg-blue-500 hover:bg-blue-700'>Sort</Button>
          <Button onClick={resetProducts} className='text-white mx-2 font-bold bg-blue-500 hover:bg-blue-700'>Reset</Button>
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

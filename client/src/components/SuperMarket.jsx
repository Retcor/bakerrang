import React, { useEffect, useState } from 'react'
import { SERVER_PREFIX } from '../App.jsx'
import { productLicenses } from '../constants/index.js'
import { request } from '../utils/index.js'
import { useTheme } from '../providers/ThemeProvider.jsx'
import ContentWrapper from './ContentWrapper.jsx'
import ProductCounter from './ProductCounter.jsx'
import { ConfirmModal } from './index.js'

const SuperMarket = () => {
  const { isDark } = useTheme()
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
        title='Reset Shopping List'
        message='Are you sure you want to reset all product counts? This will clear your entire shopping list.'
        confirmFunc={resetProducts}
        cancelFunc={() => setConfirmOpen(false)}
      />

      {/* Hero Section */}
      <div className={`rounded-2xl p-8 mb-8 transition-all duration-300 ${isDark ? 'glass-card-dark' : 'glass-card-light'} border ${isDark ? 'border-white/10' : 'border-black/10'}`}>
        <div className="flex items-center space-x-4 mb-6">
          <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${isDark ? 'bg-accent-dark' : 'bg-accent-light'}`}>
            <svg className={`w-8 h-8 ${isDark ? 'text-gray-900' : 'text-white'}`} fill="currentColor" viewBox="0 0 24 24">
              <path d="M7 4V2a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v2h4a1 1 0 0 1 0 2h-1v11a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V6H3a1 1 0 0 1 0-2h4zM9 3v1h6V3H9zm8 3H7v11a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V6z"/>
              <path d="M9 8a1 1 0 0 1 2 0v8a1 1 0 0 1-2 0V8zm4 0a1 1 0 0 1 2 0v8a1 1 0 0 1-2 0V8z"/>
            </svg>
          </div>
          <div>
            <h2 className={`text-2xl font-bold ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>
              Shopping List Manager
            </h2>
            <p className={`text-sm ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>
              Track your Supermarket Simulator products with smart counters
            </p>
          </div>
        </div>

        {products.length === 0 && (
          <div className="text-center py-8">
            <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${isDark ? 'bg-white/10' : 'bg-black/10'}`}>
              <svg className={`w-8 h-8 ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M9 1v6m6-6v6" />
              </svg>
            </div>
            <h3 className={`text-lg font-medium mb-2 ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>No products available</h3>
            <p className={`text-sm ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>
              Visit the Account page to configure your Product Licenses and start managing your shopping list
            </p>
          </div>
        )}

        {products.length > 0 && (
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <span className={`text-sm font-medium ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>
                {products.length} Products Available
              </span>
              <span className={`text-xs px-2 py-1 rounded-full ${isDark ? 'bg-accent-dark text-gray-900' : 'bg-accent-light text-white'}`}>
                {products.filter(p => p.count > 0).length} In Cart
              </span>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={sortProducts}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${isDark ? 'glass-dark text-theme-dark hover:bg-white/20' : 'glass-light text-theme-light hover:bg-black/20'} border ${isDark ? 'border-white/20' : 'border-black/20'}`}
              >
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                  </svg>
                  <span>Sort by Count</span>
                </div>
              </button>
              <button
                onClick={checkResetProducts}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 shadow-lg ${isDark ? 'btn-primary-dark' : 'btn-primary-light'}`}
              >
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Reset All</span>
                </div>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Products Grid */}
      {products.length > 0 && (
        <div className={`rounded-2xl overflow-hidden transition-all duration-300 ${isDark ? 'glass-card-dark' : 'glass-card-light'} border ${isDark ? 'border-white/10' : 'border-black/10'}`}>
          <div className={`px-8 py-6 border-b ${isDark ? 'border-white/10 bg-white/5' : 'border-black/10 bg-black/5'}`}>
            <h3 className={`text-xl font-bold ${isDark ? 'text-theme-dark' : 'text-theme-light'}`}>
              Your Products
            </h3>
            <p className={`text-sm ${isDark ? 'text-theme-secondary-dark' : 'text-theme-secondary-light'}`}>
              Tap + or - to manage quantities in your shopping cart
            </p>
          </div>
          <div className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {products.map(product => (
                <ProductCounter
                  key={product.descr}
                  product={product}
                  incrementer={() => incrementProduct(product.descr)}
                  decrementer={() => decrementProduct(product.descr)}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </ContentWrapper>
  )
}

export default SuperMarket

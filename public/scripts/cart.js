const containerEl = document.getElementById("container")

async function fetchItems() {
  try {
    const res = await fetch('/cart/items')
    const data = await res.json()

    if (data.length === 0) {
      renderEmpty()
    } else {
      renderCart(data)
    }
  } catch (error) {
    console.error("Error fetching items:", error)
  }
}

function renderEmpty() {
  containerEl.innerHTML = `
    <div class="empty-cart">
      <img src="/icon/empty_cart.png" alt="Empty cart">
      <h2>Your cart is empty</h2>
      <p>Discover discounted products near you.</p>
      <a href="/consumer/dashboard" class="btn-secondary">Back to dashboard</a>
    </div>
  `
}

function renderCart(items) {
  const total = items.reduce((sum, item) => sum + item.quantity * item.price, 0)
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0)

  let itemsHtml = ''
  items.forEach(item => {
    // last unit → "×" (delete), more than one → "−" (decrease)
    const removeIcon = item.quantity === 1 ? '×' : '−'
    const lineTotal = (item.quantity * item.price).toFixed(2)

    itemsHtml += `
      <div class="cart-item">
        <div class="cart-item-image">
          <img src="/uploads/${item.image_path}" alt="${item.title}">
        </div>
        <div class="cart-item-info">
          <div class="cart-item-name">${item.title}</div>
          <div class="cart-item-controls">
            <button class="qty-btn remove-btn" data-id="${item.product_id}">${removeIcon}</button>
            <span class="qty-counter">${item.quantity}</span>
            <button class="qty-btn increase-btn" data-id="${item.product_id}">+</button>
          </div>
        </div>
        <div class="cart-item-price">${lineTotal} TL</div>
      </div>
    `
  })

  containerEl.innerHTML = `
    <h1 class="page-title">My Cart (${itemCount})</h1>
    <div class="cart-layout">
      <div class="cart-items">${itemsHtml}</div>
      <aside class="cart-summary">
        <h2 class="summary-title">Order Summary</h2>
        <div class="summary-row">
          <span>Items</span>
          <span>${itemCount}</span>
        </div>
        <div class="summary-row summary-total">
          <span>Total</span>
          <span>${total.toFixed(2)} TL</span>
        </div>
        <button id="buyBtn">Buy Now</button>
      </aside>
    </div>
  `

  attachListeners()
}

function renderPurchaseSuccess() {
  containerEl.innerHTML = `
    <div class="empty-cart">
      <h2>Thanks for your purchase!</h2>
      <p>Your order has been placed.</p>
      <a href="/consumer/dashboard" class="btn-secondary">Back to dashboard</a>
    </div>
  `
}

function showError(message) {
  document.querySelector(".cart-error")?.remove()
  const errorEl = document.createElement("div")
  errorEl.className = "cart-error"
  errorEl.textContent = message
  containerEl.insertBefore(errorEl, containerEl.firstChild)
}

function attachListeners() {
  document.querySelectorAll(".remove-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const productId = btn.dataset.id
      const res = await fetch("/cart/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId })
      })
      const data = await res.json()
      if (data.success) await fetchItems()
    })
  })

  document.querySelectorAll(".increase-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const productId = btn.dataset.id
      const res = await fetch("/cart/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId })
      })
      const data = await res.json()
      if (data.success) {
        await fetchItems()
      } else {
        showError(data.message)
      }
    })
  })

  document.getElementById("buyBtn").addEventListener("click", async () => {
    const res = await fetch("/cart/purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    })
    const data = await res.json()
    if (data.success) {
      renderPurchaseSuccess()
    } else {
      showError(data.message)
    }
  })
}

fetchItems()

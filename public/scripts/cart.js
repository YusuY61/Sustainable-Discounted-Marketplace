const containerEl = document.getElementById("container")

async function fetchItems() {
  try {
    const res = await fetch('/cart/items')
    const data = await res.json()

    if (data.length === 0) {
      containerEl.innerHTML = ''
      containerEl.innerHTML += `
        <div id="emptyCart">
          <img id="empty_icon" src="icon/empty_cart.png">
          <h2>Your cart is empty!</h2>
        </div>
      `
    } else {
      containerEl.innerHTML = ''

      let html = ''

      html += `
        <div id="items">
          <div id="cart">
            <p id="cartTitle">My Cart (${data.length})</p>
            <hr class="line">
          
      `

      data.forEach(item => {
        html += `
        <div class="item">
              <div class="img"><img src="/uploads/${item.image_path}" style="height: 150px; width: 150px;"></div>
              <hr>
          <div class="product-info">
            <div class="product-name">${item.title}</div>
            <div class="buttons">
        `
        if (item.quantity === 1) {
          html += `<div class="button remove-btn" data-id="${item.product_id}"><img src="/icon/trash.png"></div>`
        } else {
          html += `<div class="button remove-btn" data-id="${item.product_id}"><img src="/icon/minus-small.png"></div>`
        }  

        html += `
              <div class="counter">${item.quantity}</div>
              <div class="button increase-btn" data-id="${item.product_id}"><img src="/icon/plus-small.png"></div>
            </div>
            <div class="price"><span class="price">${item.quantity * item.price}</span> TL</div>
          </div>
        `
      });

      html += `
        </div>
        </div>
          <div id="total">
            <span>Order Summary</span>
          </div>
        </div>
      `

      containerEl.innerHTML = html
    }
  } catch (error) {
    console.error("Error fetching items:", error)
  }

  document.querySelectorAll(".remove-btn").forEach(btn => {
  btn.addEventListener("click", async () => {
    const productId = btn.dataset.id;

    const res = await fetch("/cart/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId })
    });

    const data = await res.json();
    if (data.success) {
      await fetchItems();
    }
  });
});

document.querySelectorAll(".increase-btn").forEach(btn => {
  btn.addEventListener("click", async () => {
    const productId = btn.dataset.id;

    const res = await fetch("/cart/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId })
    });

    const data = await res.json();
    if (data.success) {
      await fetchItems();
    }
  });
});
}

fetchItems();
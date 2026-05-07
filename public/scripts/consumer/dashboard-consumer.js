console.log("sa")

document.querySelectorAll(".add-to-cart").forEach(btn => {
  btn.addEventListener("click", async () => {
    const productId = btn.dataset.id;

    const res = await fetch("/cart/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId })
    });

    const data = await res.json();
    if (data.success) {
      btn.textContent = "Added!";
    } else {
      alert(data.message || "Something went wrong.");
    }
  });
});
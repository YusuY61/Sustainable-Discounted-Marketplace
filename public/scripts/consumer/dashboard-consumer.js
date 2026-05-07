console.log("sa")

console.log("branch ogrenioz")

document.querySelectorAll(".add-to-cart").forEach(btn => {
    btn.addEventListener("click", async () => {
      const productId = btn.dataset.id;

      const res = await fetch("/cart/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId })
      });

      const data = await res.json();
      console.log(data)
      if (data.success) {
        btn.textContent = "Added!";
        setTimeout(() => btn.textContent = "Add to Cart", 2000);
      } else {
        alert(data.message || "Something went wrong.");
      }
    });
  });
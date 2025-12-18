# BookCourier Server 🚀

Modern REST API for **BookCourier**, built with **Node.js, Express, MongoDB, and Stripe**.  
Handles users, roles, books, orders, payments, wishlists, and reviews.

---

## ✨ Highlights

- 🔐 Role-based system (admin / librarian / user)
- 📚 Book publishing workflow
- 💳 Stripe payment integration
- 🛒 Order & payment tracking
- ❤️ Wishlist support
- ⭐ Verified purchase reviews
- ⚙️ Environment-based configuration

---

## 🧱 Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** MongoDB Atlas
- **Payments:** Stripe
- **Utilities:** dotenv, cors
- **Dev Tooling:** nodemon

---

## 📁 Structure

/
├── index.js
├── package.json
├── .env
└── README.md

yaml
Copy code

---


📦 Install & Run


  
npm install
npm start
Server runs at:


http://localhost:4040
🔗 API Overview
👤 Users & Roles


POST	/user-role	Create/update user role
GET	/user-role/:email	Get role
GET	/users	Get all users
PUT	/users/role/:email	Update role

📚 Books

GET	/books	All books (filter by status)
GET	/books/latest	Latest 6 books
GET	/books/:id	Book details
POST	/books	Add book
PATCH	/books/:id/publish	Publish/unpublish

🛒 Orders

POST	/orders	Create order
GET	/orders/user/:email	User orders
PATCH	/orders/:id	Mark as paid

💳 Payments (Stripe)

POST	/create-payment-intent	Create payment intent

❤️ Wishlist



POST	/wishlist	Add item
GET	/wishlist?email=	Get user wishlist

⭐ Reviews



GET	/can-review	Verify purchase
POST	/reviews	Submit review
GET	/reviews/:bookId	Book reviews

🧪 Health Check
http

GET /
Response

BookCourier Server Running


🧠 Business Logic Notes
Admin role is auto-assigned using ADMIN_EMAIL

Reviews allowed only after purchase

New books default to unpublished

Payments stored with transaction ID

📜 Scripts
json
Copy code
"start": "nodemon index.js"
📄 License
ISC License © 2025

👨‍💻 Author
Nazrul Islam
Frontend Developer • React • Firebase • MongoDB


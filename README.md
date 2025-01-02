# Gas Fee Delegation Server for Transactions

This repository contains a server implementation for gas fee delegation using Prisma and Node.js. Follow the steps below to set up and run the server.

---

## Prerequisites

Ensure you have the following installed on your system:

- **Node.js** (version 22)
- **npm** (comes with Node.js)
- **SQLite** (or any database supported by Prisma)

---

## Step-by-Step Setup

### 1. Install Dependencies

Run the following command to install the required Node.js packages:

```bash
npm install
```

---

### 2. Configure Environment Variables

Create a `.env.local` file in the root directory: you can use a template.env file

---

### 4. Prisma Setup

#### a. Initialize Prisma

Run the following command to initialize Prisma and create the SQLite database:

```bash
npx prisma migrate dev --name init
```

#### b. Generate Prisma Client

Generate the Prisma client with the command:

```bash
npx prisma generate
```

---

### 5. Start the Server

Run the server in development mode:

```bash
npm run dev
```

The server will start at `http://localhost:3000`.

---

## API Endpoints

### **`POST /api/signAsFeePayer`**

#### Request

Your contract address should be registered via management UI

- **Header:**
  ````json
  {
    "Content-Type": "application/json",
  }
  ```
  ````
- **Body:**
  ```json
  {
    "userSignedTx": "<your-rlp-encoded-signed-transaction>"
  }
  ```

#### Response

- **Success:**
  ```json
  {
    "message": "Request was successful",
    "data": {
      /* transaction receipt details */
    }
  }
  ```
- **Error:**
  ```json
  {
    "message": "Error details",
    "data": "message"
  }
  ```

---

## Contributing

Contributions are welcome! Feel free to submit a pull request or open an issue for discussion.

---

## License

This project is licensed under the MIT License.

```

```

# WasteBloom Bank

WasteBloom Bank is a modern, web-based Waste Bank (Bank Sampah) application designed to digitize and streamline waste management processes. It connects users who want to deposit recyclable waste with admins who manage the collection, pricing, and transactions.

Built with **Node.js**, **Express**, and **SQLite**, featuring a beautiful and responsive UI/UX designed with **Tailwind CSS**.

## Features

### User Portal
*   **Dashboard**: View real-time balance, total waste deposited, and recent activity.
*   **Deposit Waste**: Submit waste deposit requests with weight and notes.
*   **Transaction History**: Track the status of all deposits (Pending, Approved, Rejected).
*   **Withdrawal**: Request balance withdrawals to various bank accounts or e-wallets.
*   **Profile**: View and manage personal account details.

### Admin Portal
*   **Admin Dashboard**: Overview of system statistics (Total Users, Total Weight, Pending Actions).
*   **User Management**: user lists, view detailed profiles, and edit user information.
*   **Waste Management**: Add, edit, and toggle active status of waste types (e.g., Plastic, Paper, Metal).
*   **Transaction Approval**: Review user deposits, edit weights if necessary, and approve or reject transactions.
*   **Withdrawal Processing**: Review and process user fund withdrawal requests.

## Tech Stack
*   **Backend**: Node.js, Express.js
*   **Database**: SQLite (via `better-sqlite3`)
*   **Frontend**: EJS (Templating), Tailwind CSS (Styling)
*   **Authentication**: `express-session`, `bcrypt` for password hashing

## Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/eruvierda/WasteBloom-Bank.git
    cd WasteBloom-Bank
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Setup Database**
    The application uses SQLite. Run the seed script to initialize the database with default waste types and an admin account.
    ```bash
    node seed.js
    ```

4.  **Run the Simulation (Optional)**
    Populate the database with dummy users and transaction history for testing.
    ```bash
    node simulation.js
    node simulate_withdrawals.js
    ```

5.  **Start the Server**
    ```bash
    # Standard start
    node server.js
    
    # Development mode (with auto-reload)
    npm run dev
    ```

6.  **Access the App**
    Open your browser and navigate to `http://localhost:3000`

## Default Accounts

*   **Admin Account**:
    *   Email: `admin@bs.com`
    *   Password: `admin123`

*   **User Accounts** (if simulation run):
    *   Email: `user1@test.com` ... `user10@test.com`
    *   Password: `password123`

## License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

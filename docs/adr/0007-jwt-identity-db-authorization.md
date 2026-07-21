# Email JWT is identity proof; role and active come from DB

For credentials (email) auth, the JWT proves identity only. On each authenticated admin API request, load the User from the database and enforce current `isActive` and role. Reject if the user is missing, inactive, or the DB role no longer authorizes the route. Do not treat JWT-embedded role as authoritative for the session lifetime.

// import { Request, Response, NextFunction } from "express";
// import jwt from "jsonwebtoken";
// import { config } from "../config/config";

// // Define a custom type for the Request object to store decoded token data
// interface CustomRequest extends Request {
//   user?: { userId: string; role: string }; // Adjust based on the token payload
// }

// export const verifyToken = (req: CustomRequest, res: Response, next: NextFunction): void => {
//   // Get the token from the Authorization header
//   const token = req.header("Authorization");

//   // If no token is provided, return an error
//   if (!token) {
//     res.status(401).json({ error: "Kein Zugriff" });
//     return; // Don't return anything else, just exit the function
//   }

//   try {
//     // Remove 'Bearer ' prefix from token and verify
//     const decoded = jwt.verify(token.replace("Bearer ", ""), config.jwtSecure as string) as { userId: string, role: string };

//     // Attach the decoded token to the request object for later use
//     req.user = { userId: decoded.userId, role: decoded.role };

//     // Move to the next middleware or route handler
//     next();
//   } catch (err) {
//     // If token is invalid, return an error
//     res.status(403).json({ error: "Token ungültig" });
//   }
// };

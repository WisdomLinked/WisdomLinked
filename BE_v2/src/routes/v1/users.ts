import { Elysia } from "elysia";
import {
  createUserController,
  deleteUserController,
  getAllUsersController,
  getUserByIdController,
  updateUserController,
} from "../../controllers/users";

export const userRoutes = new Elysia({ prefix: "/api/v1/users" })
  .use(getAllUsersController)
  .use(createUserController)
  .use(new Elysia({ prefix: "/:id" }).use(getUserByIdController))
  .use(new Elysia({ prefix: "/:id" }).use(updateUserController))
  .use(new Elysia({ prefix: "/:id" }).use(deleteUserController));

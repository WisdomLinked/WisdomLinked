import { Elysia } from "elysia";
import {
  listContactsController,
  markContactReadController,
  deleteContactController,
} from "../../controllers/contacts";

export const contactsRoutes = new Elysia({ prefix: "/api/v1/contacts" })
  // GET /api/v1/contacts — list contact submissions
  .use(listContactsController)
  // PUT /api/v1/contacts/:id/read — mark contact as read
  .use(markContactReadController)
  // DELETE /api/v1/contacts/:id — delete contact
  .use(deleteContactController);

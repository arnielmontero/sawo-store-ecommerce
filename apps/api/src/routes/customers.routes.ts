import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/requireAuth";
import { HttpError } from "../middleware/errorHandler";
import { getCustomerById, listCustomers } from "../services/customer.service";

export const customersRouter = Router();

customersRouter.use(requireAuth);

const listQuerySchema = z.object({ page: z.coerce.number().int().positive().optional() });

customersRouter.get("/", async (req, res, next) => {
  try {
    const { page } = listQuerySchema.parse(req.query);
    const result = await listCustomers(page);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

customersRouter.get("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const customer = await getCustomerById(id);
    if (!customer) throw new HttpError(404, "Customer not found");
    res.json({ customer });
  } catch (err) {
    next(err);
  }
});

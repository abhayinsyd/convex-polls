import { defineApp } from "convex/server";
import convexPolls from "convex-polls/convex.config.js";

const app = defineApp();
app.use(convexPolls);

export default app;

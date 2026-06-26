import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { deleteAuthUser, verifyFirebaseIdToken } from "./firebase-admin.js";

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  /**
   * Admin-only: Delete a Firebase Auth user account.
   * Caller must supply their own Firebase ID token for identity verification.
   */
  admin: router({
    deleteUser: publicProcedure
      .input(
        z.object({
          idToken: z.string().min(1),
          targetUid: z.string().min(1),
        })
      )
      .mutation(async ({ input }) => {
        // 1. Verify the caller's Firebase ID token
        let decoded;
        try {
          decoded = await verifyFirebaseIdToken(input.idToken);
        } catch {
          return { success: false, error: "Unauthorized: invalid or expired token." } as const;
        }

        // 2. Ensure caller identity is valid
        if (!decoded.uid) {
          return { success: false, error: "Unauthorized: could not verify caller identity." } as const;
        }

        // 3. Prevent self-deletion
        if (decoded.uid === input.targetUid) {
          return { success: false, error: "Cannot delete your own account." } as const;
        }

        // 4. Delete the Firebase Auth account
        try {
          await deleteAuthUser(input.targetUid);
          return { success: true } as const;
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "Unknown error";
          return { success: false, error: `Failed to delete auth account: ${message}` } as const;
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;

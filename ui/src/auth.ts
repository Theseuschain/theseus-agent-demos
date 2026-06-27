// Auth for Theseus Predict. Real sign-in is Google (Gmail); set AUTH_GOOGLE_ID
// and AUTH_GOOGLE_SECRET (plus AUTH_SECRET) to enable it. A demo email sign-in
// is always available so the account flow works locally without OAuth setup.
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";

const providers: any[] = [];
if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(Google);
}
providers.push(
  Credentials({
    id: "demo",
    name: "Email (demo)",
    credentials: { email: { label: "Email", type: "email" } },
    authorize: (creds) => {
      const email = String(creds?.email ?? "").toLowerCase().trim();
      if (!email || !email.includes("@")) return null;
      return { id: email, email, name: email.split("@")[0] };
    },
  }),
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/predict" },
  callbacks: {
    jwt({ token, user }) {
      if (user?.email) token.email = user.email;
      return token;
    },
    session({ session, token }) {
      if (token?.email && session.user) session.user.email = token.email as string;
      return session;
    },
  },
});

import "fastify";

declare module "fastify" {
  interface FastifyRequest {
    user: {
      id: string;
      // githubToken: string;
    } | null;
  }
}

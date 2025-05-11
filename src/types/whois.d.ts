declare module "whois" {
  const whois: {
    lookup(ip: string): Promise<string>;
  };
  export = whois;
}

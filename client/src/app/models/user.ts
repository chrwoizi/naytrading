export class User {
  id!: number;
  username!: string;
  password!: string;
  token!: string;
  isAdmin!: boolean;
  last_login!: string;
}

export class Whitelist {
  username!: string;
}

import {
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
  DataTypes,
} from 'sequelize';

export class User extends Model<
  InferAttributes<User>,
  InferCreationAttributes<User>
> {
  declare id: number;
  declare email: string;
  declare password: string;
  declare last_login: Date;
  declare status: string;
  declare createdAt: Date;
  declare updatedAt: Date;

  static initSchema(sequelize: Sequelize) {
    User.init(
      {
        id: {
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
          type: DataTypes.INTEGER,
        },

        email: {
          type: DataTypes.STRING(200),
          allowNull: false,
        },

        password: {
          type: DataTypes.STRING(200),
          allowNull: false,
        },

        last_login: {
          type: DataTypes.DATE,
        },

        status: {
          type: DataTypes.ENUM('active', 'inactive'),
          defaultValue: 'active',
        },

        createdAt: {
          allowNull: false,
          type: DataTypes.DATE,
        },

        updatedAt: {
          allowNull: false,
          type: DataTypes.DATE,
        },
      },
      {
        tableName: 'users',
        sequelize,
      }
    );

    return User;
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  static initAssociations(models) {}
}

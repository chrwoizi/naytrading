import {
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
  DataTypes,
} from 'sequelize';

export class Whitelist extends Model<
  InferAttributes<Whitelist>,
  InferCreationAttributes<Whitelist>
> {
  declare id: number;
  declare email: string;
  declare createdAt: Date;
  declare updatedAt: Date;

  static initSchema(sequelize: Sequelize) {
    Whitelist.init(
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
        tableName: 'whitelists',
        sequelize,
      }
    );

    return Whitelist;
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  static initAssociations(models) {}
}

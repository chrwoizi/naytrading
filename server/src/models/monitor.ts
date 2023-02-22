import {
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
  DataTypes,
} from 'sequelize';

export class Monitor extends Model<
  InferAttributes<Monitor>,
  InferCreationAttributes<Monitor>
> {
  declare id: number;
  declare key: string;
  declare value: string;
  declare createdAt: Date;
  declare updatedAt: Date;

  static initSchema(sequelize: Sequelize) {
    Monitor.init(
      {
        id: {
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
          type: DataTypes.INTEGER,
        },

        key: {
          type: DataTypes.STRING(200),
          allowNull: false,
        },

        value: {
          type: DataTypes.STRING,
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
        tableName: 'monitors',
        sequelize,
      }
    );

    return Monitor;
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  static initAssociations(models) {}
}

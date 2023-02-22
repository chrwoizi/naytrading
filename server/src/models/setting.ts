import {
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
  DataTypes,
} from 'sequelize';

export class Setting extends Model<
  InferAttributes<Setting>,
  InferCreationAttributes<Setting>
> {
  declare id: number;
  declare key: string;
  declare value: string;
  declare createdAt: Date;
  declare updatedAt: Date;

  static initSchema(sequelize: Sequelize) {
    Setting.init(
      {
        id: {
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
          type: DataTypes.INTEGER,
        },

        key: {
          allowNull: false,
          type: DataTypes.STRING(100),
        },

        value: {
          allowNull: true,
          type: DataTypes.STRING(100),
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
        tableName: 'settings',
        sequelize,
      }
    );

    return Setting;
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  static initAssociations(models) {}
}

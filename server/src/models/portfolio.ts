import {
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
  DataTypes,
} from 'sequelize';

export class Portfolio extends Model<
  InferAttributes<Portfolio>,
  InferCreationAttributes<Portfolio>
> {
  declare ID: number;
  declare Time: Date;
  declare User: string;
  declare Deposit: number;
  declare Balance: number;
  declare Value: number;
  declare OpenCount: number;
  declare CompleteCount: number;
  declare createdAt: Date;
  declare updatedAt: Date;

  static initSchema(sequelize: Sequelize) {
    Portfolio.init(
      {
        ID: {
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
          type: DataTypes.INTEGER,
        },

        Time: {
          type: DataTypes.DATE,
          allowNull: false,
        },

        User: {
          type: DataTypes.STRING,
          allowNull: false,
        },

        Deposit: {
          type: DataTypes.DECIMAL(14, 2),
          allowNull: false,
        },

        Balance: {
          type: DataTypes.DECIMAL(14, 2),
          allowNull: false,
        },

        Value: {
          type: DataTypes.DECIMAL(14, 2),
          allowNull: false,
        },

        OpenCount: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },

        CompleteCount: {
          type: DataTypes.INTEGER,
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
        tableName: 'portfolios',
        indexes: [{ fields: ['User'] }, { fields: ['Time'] }],
        sequelize,
      }
    );

    return Portfolio;
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  static initAssociations(models) {}
}

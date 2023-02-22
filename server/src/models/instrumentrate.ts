import {
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
  DataTypes,
  ForeignKey,
} from 'sequelize';

export class InstrumentRate extends Model<
  InferAttributes<InstrumentRate>,
  InferCreationAttributes<InstrumentRate>
> {
  declare ID: number;
  declare Time: Date;
  declare Open: number;
  declare Close: number;
  declare High: number;
  declare Low: number;
  declare createdAt: Date;
  declare updatedAt: Date;
  declare Instrument_ID: ForeignKey<number>;

  static initSchema(sequelize: Sequelize) {
    InstrumentRate.init(
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

        Open: {
          type: DataTypes.DECIMAL(8, 2),
          allowNull: true,
        },

        Close: {
          type: DataTypes.DECIMAL(8, 2),
          allowNull: true,
        },

        High: {
          type: DataTypes.DECIMAL(8, 2),
          allowNull: true,
        },

        Low: {
          type: DataTypes.DECIMAL(8, 2),
          allowNull: true,
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
        tableName: 'instrumentrates',
        indexes: [
          { fields: ['Time'] },
          { fields: ['Instrument_ID', 'Time'] },
          { fields: ['Instrument_ID'] },
        ],
        sequelize,
      }
    );

    return InstrumentRate;
  }

  static initAssociations(models) {
    InstrumentRate.belongsTo(models.instrument, {
      foreignKey: 'Instrument_ID',
    });
  }
}

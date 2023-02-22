import {
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
  DataTypes,
} from 'sequelize';
import { Source } from './source';

export class Instrument extends Model<
  InferAttributes<Instrument>,
  InferCreationAttributes<Instrument>
> {
  declare ID: number;
  declare InstrumentName: string;
  declare Capitalization: number;
  declare Isin: string;
  declare Wkn: string;
  declare FirstRateDate: Date;
  declare LastRateDate: Date;
  declare Split: string;
  declare SplitUpdatedAt: Date;
  declare createdAt: Date;
  declare updatedAt: Date;
  declare sources?: Source[];

  static initSchema(sequelize: Sequelize) {
    Instrument.init(
      {
        ID: {
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
          type: DataTypes.INTEGER,
        },

        InstrumentName: {
          type: DataTypes.STRING,
          allowNull: true,
        },

        Capitalization: {
          type: DataTypes.DECIMAL(18, 2),
          allowNull: true,
        },

        Isin: {
          type: DataTypes.STRING(12),
          allowNull: true,
        },

        Wkn: {
          type: DataTypes.STRING(6),
          allowNull: true,
        },

        FirstRateDate: {
          type: DataTypes.DATE,
          allowNull: true,
        },

        LastRateDate: {
          type: DataTypes.DATE,
          allowNull: true,
        },

        Split: {
          allowNull: true,
          type: DataTypes.STRING(30),
        },

        SplitUpdatedAt: {
          allowNull: true,
          type: DataTypes.DATE,
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
        tableName: 'instruments',
        indexes: [
          { fields: ['Capitalization'] },
          { fields: ['Isin'] },
          { fields: ['Wkn'] },
          { fields: ['Split'] },
          { fields: ['SplitUpdatedAt'] },
        ],
        sequelize,
      }
    );

    return Instrument;
  }

  static initAssociations(models) {
    Instrument.hasMany(models.snapshot, {
      foreignKey: 'Instrument_ID',
      onDelete: 'CASCADE',
      hooks: true,
    });
    Instrument.hasMany(models.userinstrument, {
      foreignKey: 'Instrument_ID',
      onDelete: 'CASCADE',
      hooks: true,
    });
    Instrument.hasMany(models.source, {
      foreignKey: 'Instrument_ID',
      onDelete: 'CASCADE',
      hooks: true,
    });
    Instrument.hasMany(models.instrumentrate, {
      foreignKey: 'Instrument_ID',
      onDelete: 'CASCADE',
      hooks: true,
    });
  }
}

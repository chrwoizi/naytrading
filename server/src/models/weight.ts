import {
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
  DataTypes,
  ForeignKey,
} from 'sequelize';

export class Weight extends Model<
  InferAttributes<Weight>,
  InferCreationAttributes<Weight>
> {
  declare ID: number;
  declare User: string;
  declare Type: string;
  declare Weight: number;
  declare createdAt: Date;
  declare updatedAt: Date;
  declare Instrument_ID: ForeignKey<number>;

  static initSchema(sequelize: Sequelize) {
    Weight.init(
      {
        ID: {
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
          type: DataTypes.INTEGER,
        },

        User: {
          type: DataTypes.STRING,
          allowNull: true,
        },

        Type: {
          type: DataTypes.STRING,
          allowNull: true,
        },

        Weight: {
          type: DataTypes.DECIMAL(12, 6),
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
        tableName: 'weights',
        indexes: [
          { fields: ['User'] },
          { fields: ['Instrument_ID'] },
          { fields: ['Type'] },
          { fields: ['User', 'Instrument_ID'] },
          { fields: ['User', 'Type'] },
          { fields: ['Instrument_ID', 'Type'] },
          { fields: ['User', 'Instrument_ID', 'Type'] },
        ],
        sequelize,
      }
    );

    return Weight;
  }

  static initAssociations(models) {
    Weight.belongsTo(models.instrument, {
      foreignKey: 'Instrument_ID',
    });
  }
}

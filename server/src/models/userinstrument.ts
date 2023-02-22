import {
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
  DataTypes,
  ForeignKey,
} from 'sequelize';

export class UserInstrument extends Model<
  InferAttributes<UserInstrument>,
  InferCreationAttributes<UserInstrument>
> {
  declare ID: number;
  declare User: string;
  declare createdAt: Date;
  declare updatedAt: Date;
  declare Instrument_ID: ForeignKey<number>;

  static initSchema(sequelize: Sequelize) {
    UserInstrument.init(
      {
        ID: {
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
          type: DataTypes.INTEGER,
        },

        User: {
          allowNull: false,
          type: DataTypes.STRING,
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
        tableName: 'userinstruments',
        indexes: [
          { fields: ['User'] },
          { fields: ['User', 'Instrument_ID'] },
          { fields: ['Instrument_ID'] },
        ],
        sequelize,
      }
    );

    return UserInstrument;
  }

  static initAssociations(models) {
    UserInstrument.belongsTo(models.instrument, {
      foreignKey: 'Instrument_ID',
    });
  }
}

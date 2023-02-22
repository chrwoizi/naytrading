import {
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
  DataTypes,
  ForeignKey,
} from 'sequelize';

export class UserSnapshot extends Model<
  InferAttributes<UserSnapshot>,
  InferCreationAttributes<UserSnapshot>
> {
  declare ID: number;
  declare User: string;
  declare ModifiedTime: Date;
  declare Decision: string;
  declare Confirmed: number;
  declare createdAt: Date;
  declare updatedAt: Date;
  declare Snapshot_ID: ForeignKey<number>;

  static initSchema(sequelize: Sequelize) {
    UserSnapshot.init(
      {
        ID: {
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
          type: DataTypes.INTEGER,
        },

        User: {
          type: DataTypes.STRING,
          allowNull: false,
        },

        ModifiedTime: {
          type: DataTypes.DATE,
          allowNull: false,
        },

        Decision: {
          type: DataTypes.STRING(8),
          allowNull: true,
        },

        Confirmed: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
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
        tableName: 'usersnapshots',
        indexes: [
          { fields: ['User'] },
          { fields: ['Decision'] },
          { fields: ['Snapshot_ID'] },
          { fields: ['User', 'Snapshot_ID'] },
          { fields: ['User', 'Snapshot_ID', 'Decision'] },
          { fields: ['User', 'Decision'] },
        ],
        sequelize,
      }
    );

    return UserSnapshot;
  }

  static initAssociations(models) {
    UserSnapshot.belongsTo(models.snapshot, {
      foreignKey: 'Snapshot_ID',
    });
  }
}

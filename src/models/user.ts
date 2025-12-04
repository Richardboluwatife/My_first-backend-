import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/sequelize";

// -----------------------------
// Interface for User attributes
// -----------------------------
interface UserAttributes {
    id: number;
    email: string;
    password: string;
    user_type: "landlord" | "tenant";
    verified: boolean;
    otp?: string | null;
    otp_expires_at?: Date | null;
    created_at?: Date;
    updated_at?: Date;
}

// For Sequelize create method, make some fields optional
interface UserCreationAttributes extends Optional<UserAttributes, "id" | "verified" | "otp" | "otp_expires_at" | "created_at" | "updated_at"> { }

// -----------------------------
// User Model
// -----------------------------
class User extends Model<UserAttributes, UserCreationAttributes>
    implements UserAttributes {
    public id!: number;
    public email!: string;
    public password!: string;
    public user_type!: "landlord" | "tenant";
    public verified!: boolean;
    public otp!: string | null;
    public otp_expires_at!: Date | null;

    public readonly created_at!: Date;
    public readonly updated_at!: Date;
}

// -----------------------------
// Sequelize Model Definition
// -----------------------------
User.init(
    {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        email: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
            validate: { isEmail: true },
        },
        password: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        user_type: {
            type: DataTypes.ENUM("landlord", "tenant"),
            allowNull: false,
        },
        verified: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
        otp: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        otp_expires_at: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        created_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
        },
        updated_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
        },
    },
    {
        sequelize,
        tableName: "users",
        timestamps: true,
        underscored: true, // matches created_at / updated_at naming
    }
);

export default User;
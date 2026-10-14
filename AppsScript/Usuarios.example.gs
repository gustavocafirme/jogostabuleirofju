/**
 * Base de dados restrita de credenciais de usuários e níveis de acesso.
 * ATENÇÃO: Este arquivo contém dados confidenciais e não deve ser versionado publicamente.
 */

const USERS_DB = [
  { username: "exemplo_admin", passMd5: "seu_hash_md5_aqui", role: "admin" },
  { username: "exemplo_subadmin", passMd5: "seu_hash_md5_aqui", role: "subadmin" },
  { username: "exemplo_auxiliar", passMd5: "seu_hash_md5_aqui", role: "auxiliar" }
];
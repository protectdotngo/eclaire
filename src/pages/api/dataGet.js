import {pool} from '../../lib/db'

export const POST = async ({request}) => {
    const data = await request.formData()
    const search = data.get('search')

    if(search){
        try {
            const query = "SELECT * FROM test.orgs WHERE name ILIKE $1"
            const values = [`%${search}%`]
            const result = await pool.query(query, values)
            return new Response(
                JSON.stringify({message: 'Success', data: result.rows}),
                {status: 200}
            )
        } catch (err){
            console.log(err)
            return new Response(
                JSON.stringify({message: 'Database error'}),
                {status: 500}
            )
        }
    }
}
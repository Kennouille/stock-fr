// vuestock-api.js - Version finale
export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const queryParams = Object.fromEntries(url.searchParams);
  const action = queryParams.action;
  const supabaseKey = context.env.SUPABASE_KEY;

  const supabaseUrl = 'https://lanxxvocjwpyegoxxxkj.supabase.co';
    const headers = {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    };

  // Récupérer le body si besoin (pour les actions POST)
  let eventBody = {};
  if (request.method === 'POST') {
    eventBody = await request.json();
  }

  if (!supabaseKey) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Supabase key not configured'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  // Gérer les différentes actions
  if (action === 'ping') {
    return new Response(JSON.stringify({
      success: true,
      message: 'Pong! Function is working',
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

    if (action === 'get-racks') {
        const response = await fetch(`${supabaseUrl}/rest/v1/w_vuestock_racks?select=*`, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
            }
        });
        const data = await response.json();
        return new Response(JSON.stringify(data), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }

    if (action === 'get-levels') {
        const response = await fetch(`${supabaseUrl}/rest/v1/w_vuestock_levels?select=*`, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
            }
        });
        const data = await response.json();
        return new Response(JSON.stringify(data), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }

    if (action === 'get-slots') {
        const response = await fetch(`${supabaseUrl}/rest/v1/w_vuestock_slots?select=*`, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
            }
        });
        const data = await response.json();
        return new Response(JSON.stringify(data), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }


  if (action === 'get-config') {
    try {
      const supabaseUrl = 'https://lanxxvocjwpyegoxxxkj.supabase.co';

      // ✅ 1. Charger les racks
      const racksResponse = await fetch(`${supabaseUrl}/rest/v1/w_vuestock_racks?select=*&order=rack_code.asc`, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      });

      if (!racksResponse.ok) {
        throw new Error(`Supabase racks error: ${racksResponse.status}`);
      }

      const racks = await racksResponse.json();

      // ✅ 2. Charger les levels
      const levelsResponse = await fetch(`${supabaseUrl}/rest/v1/w_vuestock_levels?select=*&order=display_order.asc`, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      });

      const levels = levelsResponse.ok ? await levelsResponse.json() : [];

      // ✅ 3. Charger les slots
      const slotsResponse = await fetch(`${supabaseUrl}/rest/v1/w_vuestock_slots?select=*&order=display_order.asc`, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      });

      const slots = slotsResponse.ok ? await slotsResponse.json() : [];

      // ✅ 4. Charger les articles
      const articlesResponse = await fetch(`${supabaseUrl}/rest/v1/w_articles?select=*&actif=eq.true`, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      });

      const articles = articlesResponse.ok ? await articlesResponse.json() : [];

      // ✅ 5. Assembler la structure complète
      const completeData = racks.map(rack => {
        const rackLevels = levels.filter(l => l.rack_id === rack.id).map(level => {
          const levelSlots = slots.filter(s => s.level_id === level.id).map(slot => {
            // Trouver les articles dans ce slot
            const slotArticles = articles.filter(art =>
              art.rack_id === rack.id &&
              art.level_id === level.id &&
              art.slot_id === slot.id
            ).map(art => ({
              id: art.id,
              name: art.nom,
              barcode: art.code_barre,
              photo: art.photo_url,
              quantity: parseInt(art.stock_actuel) || 0,
              reserved: parseInt(art.stock_reserve) || 0,
              price: parseFloat(art.prix_unitaire) || 0
            }));

            return {
              id: slot.id,
              code: slot.slot_code,
              full_code: slot.full_code,
              capacity: slot.capacity || 100,
              display_order: slot.display_order,
              status: slotArticles.length > 0 ? 'occupied' : 'free',
              articles: slotArticles
            };
          });

          return {
            id: level.id,
            code: level.level_code,
            display_order: level.display_order,
            slots: levelSlots
          };
        });

        return {
          id: rack.id,
          code: rack.rack_code,
          name: rack.display_name,
          position_x: rack.position_x || 100,
          position_y: rack.position_y || 100,
          rotation: rack.rotation || 0,
          width: rack.width || 3,
          depth: rack.depth || 2,
          color: rack.color || '#4a90e2',
          levels: rackLevels
        };
      });

      return new Response(JSON.stringify({
          success: true,
          data: completeData,
          count: completeData.length
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });

    } catch (error) {
      return new Response(JSON.stringify({
          success: false,
          error: error.message
        }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
    }
  }

  // Dans vuestock-api.js - fonction save-rack
    if (action === 'save-rack') {
        try {
            let body = eventBody;

            console.log('📦 Body parsed for save-rack:', body);
            console.log('🆔 ID présent?:', !!body.id);

            const supabaseUrl = 'https://lanxxvocjwpyegoxxxkj.supabase.co';

            const payload = {
                rack_code: body.code || body.rack_code || `RACK_${Date.now()}`,
                display_name: body.name || body.display_name || `Étagère ${body.code}`,
                position_x: Math.round(body.position_x || body.x || 100),
                position_y: Math.round(body.position_y || body.y || 100),
                rotation: body.rotation || 0,
                width: body.width || 3,
                depth: body.depth || 2,
                color: body.color || '#4a90e2'
            };

            // CORRECTION 2 : Limiter rack_code à 10 caractères maximum
            if (payload.rack_code && payload.rack_code.length > 10) {
                payload.rack_code = payload.rack_code.substring(0, 10);
                console.log(`✂️ Code rack tronqué à 10 chars: ${payload.rack_code}`);
            }

            // Nettoyer le payload (enlever les undefined)
            Object.keys(payload).forEach(key => {
                if (payload[key] === undefined) {
                    delete payload[key];
                }
            });

            let response;
            let method;

            // DÉCISION : création ou mise à jour ?
            if (body.id) {
                // Mise à jour avec PATCH
                console.log(`📝 Mise à jour PATCH pour ID: ${body.id}`);
                method = 'PATCH';
                response = await fetch(`${supabaseUrl}/rest/v1/w_vuestock_racks?id=eq.${body.id}`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`,
                        'Prefer': 'return=representation'
                    },
                    body: JSON.stringify(payload)
                });
            } else {
                // Création avec POST
                console.log('➕ Création POST nouvelle étagère');
                method = 'POST';
                response = await fetch(`${supabaseUrl}/rest/v1/w_vuestock_racks`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`,
                        'Prefer': 'return=representation'
                    },
                    body: JSON.stringify(payload)
                });
            }

            const text = await response.text();
            console.log(`📥 Supabase ${method} response:`, response.status, text);

            if (!response.ok) {
                throw new Error(`Supabase ${method} error: ${response.status} - ${text}`);
            }

            let result;
            try {
                result = text ? JSON.parse(text) : null;
            } catch (e) {
                console.error('❌ Error parsing JSON:', e);
                result = { raw: text };
            }

            // Pour PATCH, Supabase peut retourner un tableau vide
            const responseData = Array.isArray(result) && result.length > 0 ? result[0] : result;

            return new Response(JSON.stringify({
                success: true,
                data: responseData || { id: body.id, ...payload },
                operation: body.id ? 'updated' : 'created',
                method: method
            }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });

        } catch (error) {
            console.error('❌ Server error in save-rack:', error);
            return new Response(JSON.stringify({
                success: false,
                error: error.message
            }), {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        }
    }

    // Gestion des niveaux (levels)
    if (action === 'save-level') {
        try {
            let body = eventBody;

            console.log('📦 Body parsed for save-level:', body);

            const supabaseUrl = 'https://lanxxvocjwpyegoxxxkj.supabase.co';

            // Vérifier les données requises
            if (!body.rack_id) {
                throw new Error('rack_id is required');
            }

            const payload = {
                rack_id: body.rack_id,
                level_code: body.level_code || body.code || `LVL_${Date.now()}`,
                display_order: body.display_order || 1,
                created_at: new Date().toISOString()
            };

            // Nettoyer le payload
            Object.keys(payload).forEach(key => {
                if (payload[key] === undefined) {
                    delete payload[key];
                }
            });

            let response;
            let method;

            // Décision: création ou mise à jour ?
            if (body.id) {
                // Mise à jour d'un niveau existant
                console.log(`📝 Mise à jour PATCH du niveau ID: ${body.id}`);
                method = 'PATCH';
                response = await fetch(`${supabaseUrl}/rest/v1/w_vuestock_levels?id=eq.${body.id}`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`,
                        'Prefer': 'return=representation'
                    },
                    body: JSON.stringify(payload)
                });
            } else {
                // Création d'un nouveau niveau
                console.log('➕ Création POST nouveau niveau');
                method = 'POST';
                response = await fetch(`${supabaseUrl}/rest/v1/w_vuestock_levels`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`,
                        'Prefer': 'return=representation'
                    },
                    body: JSON.stringify(payload)
                });
            }

            const text = await response.text();
            console.log(`📥 Supabase ${method} response for level:`, response.status, text);

            if (!response.ok) {
                throw new Error(`Supabase ${method} error: ${response.status} - ${text}`);
            }

            let result;
            try {
                result = text ? JSON.parse(text) : null;
            } catch (e) {
                console.error('❌ Error parsing JSON:', e);
                result = { raw: text };
            }

            // Pour PATCH, Supabase peut retourner un tableau vide
            const responseData = Array.isArray(result) && result.length > 0 ? result[0] : result;

            return new Response(JSON.stringify({
                success: true,
                data: responseData || { id: body.id, ...payload },
                operation: body.id ? 'updated' : 'created'
            }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });

        } catch (error) {
            console.error('❌ Server error in save-level:', error);
            return new Response(JSON.stringify({
                success: false,
                error: error.message
            }), {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        }
    }

    // Gestion des emplacements (slots)
    if (action === 'save-slot') {
        try {
            let body = eventBody;

            console.log('📦 Body parsed for save-slot:', body);

            const supabaseUrl = 'https://lanxxvocjwpyegoxxxkj.supabase.co';

            // Vérifier les données requises
            if (!body.level_id) {
                throw new Error('level_id is required');
            }

            // NOUVEAU : Construire le full_code
            // Pour cela, nous devons d'abord récupérer le rack et le level
            // 1. D'abord, récupérer le level pour avoir son rack_id et level_code
            const levelResponse = await fetch(`${supabaseUrl}/rest/v1/w_vuestock_levels?id=eq.${body.level_id}`, {
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`
                }
            });

            if (!levelResponse.ok) {
                throw new Error(`Failed to fetch level: ${levelResponse.status}`);
            }

            const levels = await levelResponse.json();
            if (!levels || levels.length === 0) {
                throw new Error(`Level ${body.level_id} not found`);
            }

            const level = levels[0];

            // 2. Récupérer le rack pour avoir son rack_code
            const rackResponse = await fetch(`${supabaseUrl}/rest/v1/w_vuestock_racks?id=eq.${level.rack_id}`, {
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`
                }
            });

            if (!rackResponse.ok) {
                throw new Error(`Failed to fetch rack: ${rackResponse.status}`);
            }

            const racks = await rackResponse.json();
            if (!racks || racks.length === 0) {
                throw new Error(`Rack ${level.rack_id} not found`);
            }

            const rack = racks[0];

            // 3. Construire le full_code : rack_code + level_code + slot_code
            const fullCode = `${rack.rack_code}-${level.level_code}-${body.slot_code || body.code}`;

            const payload = {
                level_id: body.level_id,
                slot_code: body.slot_code || body.code || `SLOT_${Date.now()}`,
                display_order: body.display_order || 1,
                status: body.status || 'free',
                capacity: body.capacity || 100,
                full_code: fullCode, // AJOUT IMPORTANT !
                created_at: new Date().toISOString()
            };

            console.log('📤 Payload avec full_code:', payload);

            // Nettoyer le payload
            Object.keys(payload).forEach(key => {
                if (payload[key] === undefined) {
                    delete payload[key];
                }
            });

            let response;
            let method;

            // Décision: création ou mise à jour ?
            if (body.id) {
                // Mise à jour d'un emplacement existant
                console.log(`📝 Mise à jour PATCH du slot ID: ${body.id}`);
                method = 'PATCH';
                response = await fetch(`${supabaseUrl}/rest/v1/w_vuestock_slots?id=eq.${body.id}`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`,
                        'Prefer': 'return=representation'
                    },
                    body: JSON.stringify(payload)
                });
            } else {
                // Création d'un nouvel emplacement
                console.log('➕ Création POST nouveau slot');
                method = 'POST';
                response = await fetch(`${supabaseUrl}/rest/v1/w_vuestock_slots`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`,
                        'Prefer': 'return=representation'
                    },
                    body: JSON.stringify(payload)
                });
            }

            const text = await response.text();
            console.log(`📥 Supabase ${method} response for slot:`, response.status, text);

            if (!response.ok) {
                throw new Error(`Supabase ${method} error: ${response.status} - ${text}`);
            }

            let result;
            try {
                result = text ? JSON.parse(text) : null;
            } catch (e) {
                console.error('❌ Error parsing JSON:', e);
                result = { raw: text };
            }

            // Pour PATCH, Supabase peut retourner un tableau vide
            const responseData = Array.isArray(result) && result.length > 0 ? result[0] : result;

            return new Response(JSON.stringify({
                success: true,
                data: responseData || { id: body.id, ...payload },
                operation: body.id ? 'updated' : 'created'
            }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });

        } catch (error) {
            console.error('❌ Server error in save-slot:', error);
            return new Response(JSON.stringify({
                success: false,
                error: error.message
            }), {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        }
    }

      if (action === 'delete-rack') {
        try {
            // ✅ CORRECTION : Récupérer l'ID depuis les query params
            const rackId = queryParams.rackId;

            if (!rackId) {
                throw new Error('rackId is required for deletion');
            }

            const supabaseUrl = 'https://lanxxvocjwpyegoxxxkj.supabase.co';

            console.log('🗑️ Deleting rack with ID:', rackId);

            const response = await fetch(`${supabaseUrl}/rest/v1/w_vuestock_racks?id=eq.${rackId}`, {
                method: 'DELETE',
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`
                }
            });

            const text = await response.text();

            if (!response.ok) {
                throw new Error(`Supabase error: ${response.status} - ${text}`);
            }

            return new Response(JSON.stringify({
                success: true,
                message: 'Rack deleted successfully'
            }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });

        } catch (error) {
            console.error('❌ Error in delete-rack:', error);
            return new Response(JSON.stringify({
                success: false,
                error: error.message
            }), {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        }
    }


    if (action === 'update-stock') {
        try {
            const body = eventBody || {};
            const { article_id, new_quantity } = body;

            console.log('📊 Mise à jour stock:', { article_id, new_quantity });

            if (!article_id || new_quantity === undefined) {
                return {
                    statusCode: 400,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    body: JSON.stringify({
                        success: false,
                        error: 'article_id et new_quantity sont requis'
                    })
                };
            }

            const supabaseUrl = 'https://lanxxvocjwpyegoxxxkj.supabase.co';

            // Mettre à jour la table w_articles
            const response = await fetch(`${supabaseUrl}/rest/v1/w_articles?id=eq.${article_id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify({
                    stock_actuel: new_quantity,
                    updated_at: new Date().toISOString(),
                    date_maj_stock: new Date().toISOString()
                })
            });


            const text = await response.text();
            console.log(`📥 Supabase PATCH response:`, response.status, text);

            if (!response.ok) {
                throw new Error(`Supabase error: ${response.status} - ${text}`);
            }

            let result;
            try {
                result = text ? JSON.parse(text) : null;
            } catch (e) {
                console.error('❌ Error parsing JSON:', e);
                result = { raw: text };
            }

            const responseData = Array.isArray(result) && result.length > 0 ? result[0] : result;

            return new Response(JSON.stringify({
                success: true,
                message: 'Stock mis à jour avec succès',
                data: responseData
            }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });

        } catch (error) {
            console.error('❌ Error in update-stock:', error);
            return new Response(JSON.stringify({
                success: false,
                error: error.message
            }), {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        }
    }

  // Si aucune action reconnue
  return new Response(JSON.stringify({
      success: true,
      message: `Action '${action}' not implemented`
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
};
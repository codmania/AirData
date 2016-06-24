window.searchParams = {};

require(['/js/config.js'], function() {
    require(['jsPDF', 'jquery', 'bootstrap', 'html2canvas', 'common', 'moment', 'daterangepicker', 'multiselect'], function() {

        var $body = $('body');
        var $view = $('#view');
        var $navLinks = $('.main-nav a');
        var path = location.hash.replace(/#/, '').split('/')[1];
        if(path){
            path = path.length == 3 ? '' : path;
        } else {
            path = '';
        }
        var basePath = '/my/airiq/reports';
        var link = basePath + '/#/' + path;

        window.defaultCarrierGroup = 'all';
        window.defaultCarrier = 'SA';
        var userData = localStorage.getItem('auth');
        var userCarrierGroups = [];
        if(userData){
            window.defaultCarrier = JSON.parse(userData).defaultCarrier || 'SA';
            userCarrierGroups = JSON.parse(userData).carrierGroups || [];
        }
        window.userCarrierGroups = userCarrierGroups;
        var optionsGroups = '';
        var groupsLabels = Object.keys(userCarrierGroups);
        for(var i in groupsLabels){
            var label = groupsLabels[i];
            optionsGroups += '<optgroup label="' + label + '">';
            for(var j in userCarrierGroups[label]){
                var airline = userCarrierGroups[label][j];
                if(airline == window.defaultCarrier) { continue; }
                optionsGroups += '<option value="' + i + '-' + airline+ '">' + airline + '</option>';
            }
            optionsGroups += '</optgroup>';
        }

        var $carrierGroups = $body.find('#carrierGroups').find('select');
        $carrierGroups.html(optionsGroups);

        //todo fix main page loads two times
        $body.on('click', '.main-nav a', function(e, eventData){ // here is should not use $navLinks because $(this) became body

            var $self = $(this);
            var path = $self.attr('href');
            $navLinks.removeClass('active');
            $self.addClass('active');

            $body.find('.page').hide();
            var $page = $($self.data('target'));
            if($page.length){
                $page.show();
                switch ($self.data('target')){
                    case '#main':
                        window.searchParams.page = 'index';
                        window.searchParams.pageUrl = '';
                        break;
                    case '#history':
                        window.searchParams.page = 'history';
                        window.searchParams.pageUrl = '/history';
                        break;
                    case '#demand':
                        window.searchParams.page = 'demand';
                        window.searchParams.pageUrl = '/demand';
                        break;
                }
            } else {
                //show loader

                switch(path){
                    case basePath + '/#/history.html':
                    case basePath + '/#/history':
                        window.searchParams.page = 'history';
                        window.searchParams.pageName = 'History';
                        window.searchParams.pageUrl = '/history';
                        load('history');
                        break;
                    case basePath + '/#/demand.html':
                    case basePath + '/#/demand':
                        window.searchParams.page = 'demand';
                        window.searchParams.pageName = 'Demand';
                        window.searchParams.pageUrl = '/demand';
                        load('demand');
                        break;
                    case basePath + '/#/index.html':
                    case basePath + '/#/index':
                    case basePath + '/#/':
                    default:
                        window.searchParams.page = 'index';
                        window.searchParams.pageName = '';
                        window.searchParams.pageUrl = '';
                        load('main');
                }

                if(eventData){
                    handlePath();
                }
            }

        });

        $body.on('click', '#logout', function(){
            localStorage.removeItem('auth'); //may be make logout from API
            location.pathname = '/login';
        });

        $body.on('change', '.carrier-groups', function(){
            var page = $(this).parents('.groups-block').data('page');
            var pageId = '#' + page.toLowerCase();

            //-------------------------reset
            $(pageId + ' .toggle-buttons').each(function() {
                $(this).prop('checked', false);
            });
            $(pageId + ' [data-toggle="buttons"]').find('label').removeClass('active');
            //------------------------------

            var group = getCheckedArr('.groups-wrapper-' + page.toLowerCase());
            window['selectedGroup' + page] = group;

            $body.trigger('selectedGroup' + page);
        });

        $body.on('click', '.toggle-buttons-block', function(e){
            var page = $(this).parents('.groups-block').data('page');
            var pageId = '#' + page.toLowerCase();

            $(pageId + ' .carrier-groups option:selected').each(function() {
                $(this).prop('selected', false);
            });
            $(pageId + ' .toggle-buttons').each(function() {
                $(this).prop('checked', false);
            });
            $(e.target).find('.toggle-buttons').prop('checked', true);
            $(pageId + ' .carrier-groups').multiselect('refresh');

            var group = getCheckedArr('.groups-wrapper-' + page.toLowerCase());
            window['selectedGroup' + page] = group;

            $body.trigger('selectedGroup' + page);
        });

        $body.on('click', '.remove-airline', function(){
            var page = $(this).parents('.page').attr('id');
            var name = 'selectedGroup' + page[0].toUpperCase() + page.substr(1);
            var airline = $(this).data('airline');
            if(!(window[name] && window[name].indexOf('all') === -1)){
                if(page == 'history'){
                    window[name] = Object.keys(window.globalDataHistory.data);
                } else {
                    window[name] = Object.keys(window.globalData.data);
                }
            }
            window[name].splice(window[name].indexOf(airline), 1);
            $body.trigger(name);
        });

        $body.on('multiselect-ready', function(event, id){
            $('#' + id + ' .carrier-groups').multiselect({
                maxHeight: 200,
                includeSelectAllOption: false,
                enableFiltering: true,
                enableClickableOptGroups: true,
                enableCaseInsensitiveFiltering: true,
                buttonWidth: '150px'
            });
        });

        $('.main-nav a[href="' + link + '"]').trigger('click', [true]); //trigger when page loads

        function getCheckedArr(selector){
            var vals = {};
            $(selector).find(':checked').each(function(index, item){
                var val = $(this).val();
                var dash = val.indexOf('-');
                if(dash !== -1){
                    val = val.substr(dash+1);
                }
                vals[val] = true;
            });
            vals[window.defaultCarrier] = true;

            return Object.keys(vals);
        }

        function load(page){

            $.get('/pages/' + page + '.html').done(function(data){
                //hide loader
                $view.append(data);
                require([page]);
            }).fail(function(error){
                console.warn(error);
            });

        }

    }); //end

});

window.handlePath = function(){
    var path = location.hash.replace(/#\//, '');
    var parts = path.split('/');
    var query = '';
    if(parts.length > 1){
        if(window.searchParams.page == 'index'){
            query = parts.join('/');
        } else {
            query = parts.slice(1).join('/');
        }
    }
    window.searchParams['query' + window.searchParams.pageName] = query;
};
